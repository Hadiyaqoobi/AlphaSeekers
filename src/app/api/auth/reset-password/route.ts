/**
 * POST /api/auth/reset-password
 * Body: { token: string, password: string }
 *
 * Validates a single-use, unexpired reset token, sets the new password (same
 * strength rules as /api/me/password), clears mustChangePassword, marks the
 * token used, and invalidates the user's other outstanding tokens. Rate-limited.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/passwords";
import { checkRateLimitDistributed, getClientIp } from "@/lib/security/rate-limit";

const schema = z.object({
  token: z.string().min(16).max(256),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long.")
    .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
      message: "Password must include at least one letter and one number.",
    }),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitDistributed(`reset-password:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { code: "rate_limited", message: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "weak_password", message: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const record = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { code: "invalid_token", message: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const newHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: newHash, mustChangePassword: false },
    }),
    prisma.passwordReset.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding tokens for this user.
    prisma.passwordReset.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
