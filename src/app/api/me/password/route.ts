/**
 * POST /api/me/password
 *
 * Change the current user's password.
 * Body: { currentPassword: string, newPassword: string }
 *
 * Verifies the current password before writing the new hash. Rate-limited
 * by IP + userId so a stolen session can't brute-force the current password.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import { checkRateLimitDistributed, getClientIp } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized } from "@/lib/security/session";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long.")
    .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
      message: "Password must include at least one letter and one number.",
    }),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const ip = getClientIp(request);
  const rl = await checkRateLimitDistributed(`password-change:${user.id}:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Password must be at least 8 characters.";
    return NextResponse.json({ code: "weak_password", message }, { status: 400 });
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true },
  });
  if (!account) return unauthorized();

  if (!(await verifyPassword(parsed.data.currentPassword, account.passwordHash))) {
    return NextResponse.json(
      { code: "wrong_current", message: "Current password is incorrect." },
      { status: 400 },
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { code: "same_as_current", message: "New password must be different from current password." },
      { status: 400 },
    );
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: account.id },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ ok: true });
}
