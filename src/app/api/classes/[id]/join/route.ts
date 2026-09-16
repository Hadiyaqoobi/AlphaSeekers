/**
 * POST /api/classes/[id]/join — public, unauthenticated.
 *
 * The single request behind the class join form: it creates the student's
 * platform account (with the password they chose) and puts them in the class,
 * so there is no separate sign-up step anywhere in the journey.
 *
 * Public by necessity — the whole point is that the student does not have an
 * account yet — so it is rate-limited on both the address and the network, and
 * it refuses to do anything for a class that is not published and active.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { joinClassWithNewAccount } from "@/lib/platform/class-join";
import { validateEmailStrict } from "@/lib/security/email";
import { checkRateLimitDistributed, getClientIp } from "@/lib/security/rate-limit";
import { stripHtml } from "@/lib/security/sanitize";

type Params = { params: { id: string } };

/**
 * Same field rules as /api/auth/register, deliberately: this IS registration,
 * just reached from a class. A student who joins here and a student who signs
 * up the long way must end up with an equally valid account.
 */
const joinSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(120, "That name is too long.")
    .transform(stripHtml)
    .pipe(z.string().min(1, "Please enter your full name.")),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .superRefine((value, ctx) => {
      const result = validateEmailStrict(value);
      if (!result.ok) ctx.addIssue({ code: "custom", message: result.message });
    }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "That password is too long.")
    .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
      message: "Password must include at least one letter and one number.",
    }),
  phone: z.string().trim().min(6).max(32).optional(),
  language: z.enum(["FA", "EN"]).optional(),
});

// Per-address before per-network, for the reason documented in the register
// route: Afghan carriers put many subscribers behind one public IP, so an
// IP-only limit means the sixth student on a carrier is refused on their first
// ever attempt. The address identifies a person; the IP only catches floods.
const JOIN_PER_EMAIL = { limit: 5, windowMs: 15 * 60 * 1000 };
const JOIN_PER_IP = { limit: 40, windowMs: 15 * 60 * 1000 };

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { message: "Too many attempts. Please wait a few minutes and try again.", code: "RATE_LIMITED" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

/** Failure codes → status + a message the student can act on. */
const FAILURES: Record<string, { status: number; message: string }> = {
  CLASS_NOT_FOUND: { status: 404, message: "This class could not be found." },
  CLASS_CLOSED: { status: 409, message: "This class is not open for registration." },
  CLASS_FULL: { status: 409, message: "This class is full." },
  WRONG_PASSWORD: {
    status: 409,
    message:
      "An account already uses this email. Enter that account's password to join, or sign in first.",
  },
  ACCOUNT_DEACTIVATED: {
    status: 403,
    message: "This account has been turned off. Please ask your teacher or the AlphaSeekers team.",
  },
  NOT_A_STUDENT: {
    status: 409,
    message: "This email belongs to a teacher or admin account. Please sign in instead.",
  },
};

export async function POST(request: NextRequest, { params }: Params) {
  const ip = getClientIp(request);
  const byIp = await checkRateLimitDistributed(`join:ip:${ip}`, JOIN_PER_IP);
  if (!byIp.allowed) return tooMany(byIp.retryAfterMs);

  const parsed = joinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return NextResponse.json(
      { message: issues[0]?.message ?? "Please check the form and try again.", errors: issues },
      { status: 400 },
    );
  }

  const byEmail = await checkRateLimitDistributed(
    `join:email:${parsed.data.email.toLowerCase()}`,
    JOIN_PER_EMAIL,
  );
  if (!byEmail.allowed) return tooMany(byEmail.retryAfterMs);

  try {
    const result = await joinClassWithNewAccount({ classId: params.id, ...parsed.data });

    if (!result.ok) {
      const failure = FAILURES[result.code] ?? { status: 400, message: "Could not join this class." };
      return NextResponse.json({ message: failure.message, code: result.code }, { status: failure.status });
    }

    // The client signs in with the SAME credentials immediately after this.
    return NextResponse.json(
      { ok: true, created: result.created, alreadyEnrolled: result.alreadyEnrolled },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    console.error("[classes/join] failed:", error);
    return NextResponse.json({ message: "Could not join this class. Please try again." }, { status: 500 });
  }
}
