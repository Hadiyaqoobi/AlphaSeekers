/**
 * POST /api/auth/forgot-password
 * Body: { email: string, locale?: "en" | "fa" }
 *
 * Always returns a uniform 200 { ok: true } regardless of whether an account
 * exists for the email (no account enumeration). Rate-limited per network and,
 * independently, per address.
 * On a match, issues a single-use, 1-hour reset token — only the SHA-256 hash
 * is stored; the raw token is emailed as a reset link.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/integrations/notifications";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().trim().email().max(200),
  locale: z.enum(["en", "fa"]).optional(),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Every reset email goes out through the platform's ONE Gmail account, which
// sends ~500 messages a day for everything (welcomes, reminders, resets). An
// address that can be made to receive unlimited resets is a way to exhaust
// that for the whole platform — and to flood one person's inbox.
//
// Per network (in memory — it only has to stop a burst from one place) and per
// address regardless of network. The per-address caps are counted from the
// PasswordReset rows themselves, so they survive a restart without a separate
// limiter table and are only ever consulted for addresses that exist.
const PER_IP = { limit: 20, windowMs: 15 * 60 * 1000 };
const PER_EMAIL_BURST = { limit: 3, windowMs: 60 * 60 * 1000 };
const MAX_PER_HOUR = 3;
const MAX_PER_DAY = 10;
// A double-tapped button (or an impatient second request) must not invalidate
// the link that is already on its way.
const MIN_GAP_MS = 2 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Issue a token and send the email for an EXISTING account. Runs after the
 * response is sent: awaiting SMTP only when the account exists made the reply
 * measurably slower for real addresses, which told anyone timing it which
 * emails have accounts.
 */
async function issueAndSend(user: { id: string; email: string }, locale: string): Promise<void> {
  const now = Date.now();
  const recent = await prisma.passwordReset.findMany({
    where: { userId: user.id, createdAt: { gte: new Date(now - DAY_MS) } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: MAX_PER_DAY,
  });

  if (recent.length >= MAX_PER_DAY) return;
  if (recent.filter((r) => now - r.createdAt.getTime() < HOUR_MS).length >= MAX_PER_HOUR) return;
  if (recent[0] && now - recent[0].createdAt.getTime() < MIN_GAP_MS) return;

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  // Invalidate any outstanding tokens for this user, then issue a fresh one.
  await prisma.$transaction([
    prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(now + TOKEN_TTL_MS),
      },
    }),
  ]);

  const base = (process.env.NEXTAUTH_URL || "http://localhost:3005").replace(/\/+$/, "");
  const resetUrl = `${base}/${locale}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  // Uniform response — never reveal validity or account existence.
  const uniform = NextResponse.json({ ok: true });
  if (!parsed.success) return uniform;

  const email = parsed.data.email.toLowerCase();
  const locale = parsed.data.locale ?? "en";

  const ip = getClientIp(request);
  if (!checkRateLimit(`forgot-password:ip:${ip}`, PER_IP).allowed) return uniform;
  if (!checkRateLimit(`forgot-password:email:${email}`, PER_EMAIL_BURST).allowed) return uniform;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (user?.email) {
    // Deliberately not awaited (see issueAndSend). This server is a long-lived
    // Node process, so the work finishes after the response.
    void issueAndSend({ id: user.id, email: user.email }, locale).catch((error) => {
      // Swallow — the response stays uniform even if email delivery fails.
      console.error("[forgot-password] could not issue/send a reset:", error);
    });
  }

  return uniform;
}
