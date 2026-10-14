import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { cancelMeetEvent } from "@/lib/integrations/meet";
import { deliverAndRecord, formatDateTimeForUser, listClassDeliveryTargets } from "@/lib/platform/db-store";
import { guardClassManagement } from "@/lib/security/api-guard";

type RouteContext = { params: { id: string; sessionId: string } };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  // Owning teacher keeps access; a non-owner (including a scoped employee with
  // role=ADMIN) must hold classes.edit to cancel a session. The shared guard
  // also enforces authentication, deactivation, and password-reset gating and
  // returns 404 when the class does not exist.
  const guard = await guardClassManagement(params.id);
  if (!guard.ok) return guard.response;

  // Read the session itself (scoped by BOTH ids) rather than re-loading the class
  // aggregate: that view hides archived classes (staff got a 404 here) and only
  // lists upcoming sessions, so the time in the message could be missing.
  const record = await prisma.session.findFirst({
    where: { id: params.sessionId, classId: params.id },
    select: {
      id: true,
      startTime: true,
      cancelled: true,
      googleEventId: true,
      googleCalendarId: true,
      class: { select: { name: true, teacherId: true } },
    },
  });
  if (!record) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (record.cancelled) {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  try {
    // Scope the update by BOTH ids so a sessionId that does not belong to this
    // class matches zero rows — prevents cancelling another class's session via a
    // forged /classes/{ownedClass}/sessions/{foreignSession}/cancel URL (IDOR).
    const { count } = await prisma.session.updateMany({
      where: { id: params.sessionId, classId: params.id, cancelled: false },
      data: { cancelled: true },
    });
    if (count === 0) {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }
  } catch {
    return NextResponse.json({ error: "Failed to cancel session" }, { status: 500 });
  }

  // Tell the students, in their own time zone (the server's toLocaleString printed
  // UTC on Render), on every channel they have enabled (Telegram/push were skipped
  // before), recorded as Notification rows and awaited -- a fire-and-forget send
  // could be dropped when the request ended.
  let notified = { recipients: 0, sent: 0 };
  try {
    const students = await listClassDeliveryTargets(params.id);
    notified = await deliverAndRecord(
      students,
      (student) =>
        `${record.class.name}: the session on ${formatDateTimeForUser(record.startTime, student.timezone, student.language)} has been cancelled.`,
      (student) => `session_cancelled:${record.id}:${student.id}`,
    );
  } catch (error) {
    console.error("[sessions] cancel notification failed", record.id, error);
  }

  // Best-effort: delete the backing Google Calendar event so the old Meet link is
  // no longer joinable and we don't orphan calendar events. The session is already
  // marked cancelled above — a Google failure must NEVER fail the cancellation.
  // cancelMeetEvent uses the account that CREATED the event (googleCalendarId).
  if (record.googleEventId) {
    try {
      await cancelMeetEvent({
        eventId: record.googleEventId,
        calendarId: record.googleCalendarId ?? undefined,
        teacherId: record.class.teacherId,
      });
    } catch {
      // Best-effort — cancellation already succeeded.
    }
  }

  return NextResponse.json({ ok: true, notified });
}
