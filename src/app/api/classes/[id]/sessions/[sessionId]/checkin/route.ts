import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudentEnrolledInClass } from "@/lib/platform/store";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized } from "@/lib/security/session";

type RouteContext = { params: { id: string; sessionId: string } };

/**
 * POST /api/classes/[id]/sessions/[sessionId]/checkin
 *
 * Student submits the 4-digit check-in code to verify attendance.
 *
 * Response shape:
 *   { success: true, message: string }                   on match
 *   { success: false, code: string, message: string }    on failure
 *
 * The client maps `code` to a localized error (no_code_yet, expired, wrong,
 * invalid_format).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Rate limit: 10 guesses per 15 minutes per user — enough for an honest
  // typo, not enough for brute-force.
  const rl = checkRateLimit(`checkin:${user.id}:${params.sessionId}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        code: "rate_limited",
        message: "Too many attempts. Please wait a few minutes and try again.",
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null);
  const submittedCode = typeof body?.code === "string" ? body.code.trim() : "";

  if (!/^\d{4}$/.test(submittedCode)) {
    return NextResponse.json(
      {
        success: false,
        code: "invalid_format",
        message: "Please enter a 4-digit code.",
      },
      { status: 400 },
    );
  }

  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    select: {
      classId: true,
      checkinCode: true,
      checkinCodeExpiresAt: true,
    },
  });

  if (!session || session.classId !== params.id) {
    return NextResponse.json({ message: "Session not found" }, { status: 404 });
  }

  // Only students enrolled in this class may check in. Without this, any
  // authenticated user who learns the 4-digit code could record attendance
  // for a class they're not part of. Admins are exempt (QA / impersonation),
  // consistent with the rest of the platform.
  if (user.role !== "ADMIN") {
    const enrolled = await isStudentEnrolledInClass(user.id, session.classId);
    if (!enrolled) {
      return NextResponse.json(
        {
          success: false,
          code: "not_enrolled",
          message: "You are not enrolled in this class.",
        },
        { status: 403 },
      );
    }
  }

  if (!session.checkinCode) {
    return NextResponse.json(
      {
        success: false,
        code: "no_code_yet",
        message: "No check-in code has been generated for this session yet.",
      },
      { status: 400 },
    );
  }

  if (
    session.checkinCodeExpiresAt &&
    new Date() > session.checkinCodeExpiresAt
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "expired",
        message: "This check-in code has expired. Ask your teacher for a new one.",
      },
      { status: 400 },
    );
  }

  if (submittedCode !== session.checkinCode) {
    return NextResponse.json(
      {
        success: false,
        code: "wrong",
        message: "Incorrect code. Please check and try again.",
      },
      { status: 400 },
    );
  }

  const now = new Date();
  await prisma.attendance.upsert({
    where: {
      sessionId_studentId: {
        sessionId: params.sessionId,
        studentId: user.id,
      },
    },
    update: {
      checkinVerified: true,
      checkinAt: now,
      // Also count them as attended if the Join-Meet flow hadn't already
      attended: true,
      joinedAt: now,
    },
    create: {
      sessionId: params.sessionId,
      studentId: user.id,
      attended: true,
      joinedAt: now,
      checkinVerified: true,
      checkinAt: now,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Attendance verified.",
  });
}
