import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { deliverWithFallback } from "@/lib/integrations/notifications";
import { getClassById, listClassEnrollments } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";
import { getAccessControl, can } from "@/lib/security/permissions";

type RouteContext = { params: { id: string; sessionId: string } };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const klass = await getClassById(params.id);
  if (!klass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Owning teacher keeps access; a non-owner (including a scoped employee with
  // role=ADMIN) must hold classes.edit to cancel a session.
  const access = await getAccessControl();
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isOwner = !access.deactivated && access.userId === klass.teacherId;
  if (!isOwner && !can(access, "classes.edit")) {
    return NextResponse.json({ error: "Not your class" }, { status: 403 });
  }

  try {
    // Scope the update by BOTH ids so a sessionId that does not belong to this
    // class matches zero rows — prevents cancelling another class's session via a
    // forged /classes/{ownedClass}/sessions/{foreignSession}/cancel URL (IDOR).
    const { count } = await prisma.session.updateMany({
      where: { id: params.sessionId, classId: params.id },
      data: { cancelled: true },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Failed to cancel session" }, { status: 500 });
  }

  // Notify enrolled students about cancellation
  try {
    const enrollments = await listClassEnrollments(params.id);
    const session = klass.sessions.find((s) => s.id === params.sessionId);
    const timeStr = session ? new Date(session.startTime).toLocaleString() : "";
    const message = `${klass.name}: Session${timeStr ? ` on ${timeStr}` : ""} has been cancelled.`;

    for (const enrollment of enrollments) {
      deliverWithFallback(
        { userId: enrollment.studentId, email: enrollment.email },
        message,
      ).catch(() => {});
    }
  } catch {
    // Best-effort
  }

  return NextResponse.json({ ok: true });
}
