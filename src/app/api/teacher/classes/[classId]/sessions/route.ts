/**
 * POST /api/teacher/classes/[classId]/sessions
 *
 * Instructor-managed (MANUAL) scheduling: create a new session for a class at an
 * explicit instructor-chosen time. The acting user must own the class
 * (class.teacherId === their id) or hold the "classes.edit" permission. A
 * temp-password employee must reset their password before managing sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createManualSession } from "@/lib/scheduling/sessions";
import { can, getAccessControl, type AccessControl } from "@/lib/security/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: { classId: string } };

const bodySchema = z.object({
  startTime: z.string(),
  durationMinutes: z.number().int().positive().optional(),
});

/** Owning teacher, or a scoped employee holding classes.edit, may manage sessions. */
function canManageClass(access: AccessControl, teacherId: string): boolean {
  // Deactivated accounts have no access even via the owner shortcut (can() already
  // denies deactivated users, but the owner branch would otherwise bypass it).
  if (access.deactivated) return false;
  return access.userId === teacherId || can(access, "classes.edit");
}

export async function POST(request: NextRequest, { params }: RouteContext) {
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

    const klass = await prisma.class.findUnique({
      where: { id: params.classId },
      select: { id: true, teacherId: true },
    });
    if (!klass) {
      return NextResponse.json({ message: "Class not found" }, { status: 404 });
    }
    if (!canManageClass(access, klass.teacherId)) {
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

    const result = await createManualSession({
      classId: klass.id,
      startTime,
      durationMinutes: parsed.data.durationMinutes,
    });
    if (!result.ok) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json({ sessionId: result.sessionId }, { status: 201 });
  } catch (error) {
    console.error("[teacher] createManualSession failed", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
