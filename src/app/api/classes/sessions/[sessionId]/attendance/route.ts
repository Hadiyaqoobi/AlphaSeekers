import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionAttendance, markAttendance } from "@/lib/platform/store";
import { forbidden, getSessionUser, unauthorized, type SessionUser } from "@/lib/security/session";

type RouteContext = { params: { sessionId: string } };

/**
 * Ensure the requesting teacher owns the class this session belongs to (or is
 * an admin). Prevents IDOR: a teacher must not read or modify attendance for
 * sessions of classes they do not teach.
 *
 * Returns `null` when access is allowed, otherwise a ready-to-return response
 * (404 when the session doesn't exist, 403 when it belongs to another teacher).
 */
async function assertOwnsSession(
  user: SessionUser,
  sessionId: string,
): Promise<NextResponse | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { class: { select: { teacherId: true } } },
  });

  if (!session) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  if (user.role !== "ADMIN" && session.class.teacherId !== user.id) {
    return forbidden("You do not have access to this session.");
  }

  return null;
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

    const denied = await assertOwnsSession(user, params.sessionId);
    if (denied) return denied;

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

    const denied = await assertOwnsSession(user, params.sessionId);
    if (denied) return denied;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.studentId !== "string" || typeof body.attended !== "boolean") {
        return NextResponse.json({ message: "Invalid payload: { studentId: string, attended: boolean }" }, { status: 400 });
    }

    const record = await markAttendance(params.sessionId, body.studentId, body.attended);
    return NextResponse.json(record);
}
