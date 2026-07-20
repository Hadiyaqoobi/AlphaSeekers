/**
 * POST /api/auth/forgot-password
 * Body: { email: string, locale?: "en" | "fa" }
 *
 * Always returns a uniform 200 { ok: true } regardless of whether an account
 * exists for the email (no account enumeration). Rate-limited per email+IP.
 * On a match, issues a single-use, 1-hour reset token — only the SHA-256 hash
 * is stored; the raw token is emailed as a reset link.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/integrations/notifications";
import { checkRateLimitDistributed, getClientIp } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().trim().email().max(200),
  locale: z.enum(["en", "fa"]).optional(),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  // Uniform response — never reveal validity or account existence.
  const uniform = NextResponse.json({ ok: true });
  if (!parsed.success) return uniform;

  const email = parsed.data.email.toLowerCase();
  const locale = parsed.data.locale ?? "en";

  const rl = await checkRateLimitDistributed(`forgot-password:${email}:${ip}`);
  if (!rl.allowed) return uniform;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (user?.email) {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Invalidate any outstanding tokens for this user, then issue a fresh one.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const base = (process.env.NEXTAUTH_URL || "http://localhost:3005").replace(/\/+$/, "");
    const resetUrl = `${base}/${locale}/reset-password?token=${rawToken}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch {
      // Swallow — the response stays uniform even if email delivery fails.
    }
  }

  return uniform;
}
