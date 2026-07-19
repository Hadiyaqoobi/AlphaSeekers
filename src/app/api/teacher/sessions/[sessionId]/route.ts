/**
 * PATCH /api/teacher/sessions/[sessionId]
 *
 * Instructor-managed (MANUAL) scheduling: move an existing session to a new
 * instructor-chosen time (regenerates the Meet link and re-notifies students).
 * The acting user must own the session's class (class.teacherId === their id) or
 * hold the "classes.edit" permission. A temp-password employee must reset their
 * password before managing sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { rescheduleSession } from "@/lib/scheduling/sessions";
import { can, getAccessControl, type AccessControl } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: { sessionId: string } };

const bodySchema = z.object({
  startTime: z.string(),
  durationMinutes: z.number().int().positive().optional(),
});

/** Owning teacher, or a scoped employee holding classes.edit, may manage sessions. */
function canManageClass(access: AccessControl, teacherId: string): boolean {
  return access.userId === teacherId || can(access, "classes.edit");
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const access = await getAccessControl();
    if (!access) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (access.mustChangePassword) {
      return NextResponse.json(
        { message: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" },
        { status: 403 },
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      select: { id: true, class: { select: { teacherId: true } } },
    });
    if (!session) {
      return NextResponse.json({ message: "Session not found" }, { status: 404 });
    }
    if (!canManageClass(access, session.class.teacherId)) {
      return NextResponse.json({ message: "You cannot manage this class" }, { status: 403 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    const startTime = new Date(parsed.data.startTime);
    if (Number.isNaN(startTime.getTime())) {
      return NextResponse.json({ message: "Invalid startTime" }, { status: 400 });
    }

    const result = await rescheduleSession({
      sessionId: session.id,
      startTime,
      durationMinutes: parsed.data.durationMinutes,
    });
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[teacher] rescheduleSession failed", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
