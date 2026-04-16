/**
 * POST /api/classes/[id]/sessions/[sessionId]/attend
 *
 * Mark the current student as attended. Idempotent.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

export async function POST(
  _request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) {
    return Response.json({ message: access.message }, { status: access.status });
  }

  if (access.role !== "student") {
    return forbidden("Only students mark their own attendance");
  }

  const attendance = await prisma.attendance.upsert({
    where: { sessionId_studentId: { sessionId: params.sessionId, studentId: user.id } },
    update: { attended: true, joinedAt: new Date() },
    create: {
      sessionId: params.sessionId,
      studentId: user.id,
      attended: true,
      joinedAt: new Date(),
    },
  });

  return Response.json({ ok: true, joinedAt: attendance.joinedAt });
}
