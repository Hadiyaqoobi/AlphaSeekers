import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { forbidden, getSessionUser, unauthorized, type SessionUser } from "@/lib/security/session";

type RouteContext = { params: { id: string; sessionId: string } };

const CODE_TTL_MS = 30 * 60 * 1000;

async function assertTeacherOnThisClass(
  user: SessionUser,
  classId: string,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { classId: true, class: { select: { teacherId: true } } },
  });
  if (!session || session.classId !== classId) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Session not found" }, { status: 404 }),
    };
  }
  // IDOR guard: only the class's own teacher (or an admin) may touch the code.
  if (user.role !== "ADMIN" && session.class.teacherId !== user.id) {
    return {
      ok: false,
      response: forbidden("You do not teach this class."),
    };
  }
  return { ok: true };
}

/**
 * POST /api/classes/[id]/sessions/[sessionId]/checkin-code
 *
 * Teacher generates a 4-digit check-in code for the current session.
 * Students enter this code to verify their attendance. Code expires 30 min
 * after generation. Re-posting returns a new code (previous code is replaced).
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    return forbidden("Only teachers or admins can generate a check-in code.");
  }

  const check = await assertTeacherOnThisClass(user, params.id, params.sessionId);
  if (!check.ok) return check.response;

  // 4-digit code, 1000–9999 (never leading zero, so it's always 4 visible digits)
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.session.update({
    where: { id: params.sessionId },
    data: { checkinCode: code, checkinCodeExpiresAt: expiresAt },
  });

  return NextResponse.json({
    code,
    expiresAt: expiresAt.toISOString(),
  });
}

/**
 * GET /api/classes/[id]/sessions/[sessionId]/checkin-code
 *
 * Teacher re-fetches the current code + expiry (e.g. after a page reload).
 * Students must not call this endpoint — it is role-gated.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    return forbidden("Only teachers or admins can view the check-in code.");
  }

  const check = await assertTeacherOnThisClass(user, params.id, params.sessionId);
  if (!check.ok) return check.response;

  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    select: { checkinCode: true, checkinCodeExpiresAt: true },
  });

  if (!session || !session.checkinCode) {
    return NextResponse.json({ code: null, expiresAt: null, expired: false });
  }

  const expired = Boolean(
    session.checkinCodeExpiresAt && new Date() > session.checkinCodeExpiresAt,
  );

  return NextResponse.json({
    code: expired ? null : session.checkinCode,
    expiresAt: session.checkinCodeExpiresAt?.toISOString() ?? null,
    expired,
  });
}
