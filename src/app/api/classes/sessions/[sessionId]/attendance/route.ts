import { NextRequest, NextResponse } from "next/server";

import { EnrollmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSessionAttendance, markAttendance } from "@/lib/platform/store";
import { can, getAccessControl } from "@/lib/security/permissions";
import { forbidden, getSessionUser, unauthorized, type SessionUser } from "@/lib/security/session";

type RouteContext = { params: { sessionId: string } };

/**
 * Ensure the requesting teacher owns the class this session belongs to, or is
 * staff holding `permission` (classes.view to read, classes.edit to write —
 * role=ADMIN alone is every scoped employee). Prevents IDOR: a teacher must not
 * read or modify attendance for sessions of classes they do not teach.
 *
 * Returns the session's classId when access is allowed, otherwise a
 * ready-to-return response (404 when the session doesn't exist, 403 otherwise).
 */
async function assertOwnsSession(
  user: SessionUser,
  sessionId: string,
  permission: "classes.view" | "classes.edit",
): Promise<{ ok: true; classId: string } | { ok: false; response: NextResponse }> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { classId: true, class: { select: { teacherId: true } } },
  });

  if (!session) {
    return { ok: false, response: NextResponse.json({ message: "Session not found" }, { status: 404 }) };
  }

  if (session.class.teacherId !== user.id) {
    const isStaff = user.role === "ADMIN" && can(await getAccessControl(), permission);
    if (!isStaff) {
      return { ok: false, response: forbidden("You do not have access to this session.") };
    }
  }

  return { ok: true, classId: session.classId };
}

/**
 * GET /api/classes/sessions/[sessionId]/attendance
 * Returns the attendance sheet for a session (all enrolled students + status).
 * Teachers who own the class and admins only.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
    const user = await getSessionUser();
    if (!user) {
        return unauthorized();
    }
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
        return forbidden("Only teachers or admins can view attendance.");
    }

    const check = await assertOwnsSession(user, params.sessionId, "classes.view");
    if (!check.ok) return check.response;

    const data = await getSessionAttendance(params.sessionId);
    if (!data) {
        return NextResponse.json({ message: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(data);
}

/**
 * POST /api/classes/sessions/[sessionId]/attendance
 * Mark attendance for a student. Body: { studentId, attended }
 * Teachers who own the class and admins only.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
    const user = await getSessionUser();
    if (!user) {
        return unauthorized();
    }
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
        return forbidden("Only teachers or admins can mark attendance.");
    }

    const check = await assertOwnsSession(user, params.sessionId, "classes.edit");
    if (!check.ok) return check.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.studentId !== "string" || typeof body.attended !== "boolean") {
        return NextResponse.json({ message: "Invalid payload: { studentId: string, attended: boolean }" }, { status: 400 });
    }

    // Only someone actually in THIS class can be marked. Without this a teacher
    // could write attendance rows for any user id at all — another class's
    // students, staff — into their own session.
    const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_classId: { studentId: body.studentId, classId: check.classId } },
        select: { status: true },
    });
    if (enrollment?.status !== EnrollmentStatus.ACTIVE) {
        return NextResponse.json({ message: "That student is not in this class." }, { status: 400 });
    }

    const record = await markAttendance(params.sessionId, body.studentId, body.attended);
    return NextResponse.json(record);
}
