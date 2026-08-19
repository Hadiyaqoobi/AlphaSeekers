import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { validateEmailStrict } from "@/lib/security/email";
import { hashPassword } from "@/lib/security/passwords";
import { encryptPhone } from "@/lib/security/phone-crypto";
import { checkRateLimitDistributed, getClientIp } from "@/lib/security/rate-limit";
import { stripHtml } from "@/lib/security/sanitize";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(120, "Name is too long.")
    .transform(stripHtml)
    .pipe(z.string().min(1, "Name must contain visible text.")),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .superRefine((value, ctx) => {
      const result = validateEmailStrict(value);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: result.message });
      }
    }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long.")
    .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
      message: "Password must include at least one letter and one number.",
    }),
  // Accepted for backward-compat with existing clients but IGNORED: public
  // registration always creates a STUDENT. Teacher/admin accounts are created
  // or elevated by an admin (privilege escalation prevention).
  role: z.enum(["STUDENT", "TEACHER"]).optional(),
  phone: z
    .string()
    .trim()
    .min(6, "Phone number is too short.")
    .max(32, "Phone number is too long.")
    .optional(),
  language: z.enum(["FA", "EN"]).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

/**
 * Registration rate limits.
 *
 * The old limit was the shared auth default: 5 attempts per 15 minutes keyed on
 * IP alone. Afghan mobile carriers put many subscribers behind one public
 * address (carrier-grade NAT), and a classroom or household shares one too — so
 * in practice it was five attempts per NETWORK, and the sixth student to sign up
 * was refused on their first ever try. A mistyped email or a double-tapped
 * Submit burned the budget for everyone else on that carrier.
 *
 * Keyed per email instead, which identifies a person rather than a network, with
 * a much looser per-IP ceiling kept behind it so a genuine flood is still
 * stopped.
 */
const REGISTER_PER_EMAIL = { limit: 3, windowMs: 15 * 60 * 1000 };
const REGISTER_PER_IP = { limit: 30, windowMs: 15 * 60 * 1000 };

function tooManyAttempts(retryAfterMs: number) {
  return NextResponse.json(
    { message: "Too many registration attempts. Please try again later." },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

export async function POST(request: NextRequest) {
  // Flood guard first: cheap, and it runs before we parse anything.
  const ip = getClientIp(request);
  const byIp = await checkRateLimitDistributed(`register:ip:${ip}`, REGISTER_PER_IP);
  if (!byIp.allowed) {
    return tooManyAttempts(byIp.retryAfterMs);
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    // Surface the first field-level message so the form shows something
    // useful (e.g. "Password must be at least 6 characters.") instead of the
    // generic "Invalid registration payload" the team flagged in QA.
    const issues = parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return NextResponse.json(
      {
        message: issues[0]?.message ?? "Please check the form and try again.",
        errors: issues,
      },
      { status: 400 },
    );
  }

  // Now that we know who is signing up, limit the person rather than the
  // network. Someone hammering one address is stopped; the next student on the
  // same carrier is not.
  const emailKey = parsed.data.email.trim().toLowerCase();
  const byEmail = await checkRateLimitDistributed(`register:email:${emailKey}`, REGISTER_PER_EMAIL);
  if (!byEmail.allowed) {
    return tooManyAttempts(byEmail.retryAfterMs);
  }

  const email = parsed.data.email.toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        phone: parsed.data.phone ? encryptPhone(parsed.data.phone) : null,
        // Force STUDENT regardless of client input — no self-service teacher/admin.
        role: "STUDENT",
        // ...but keep what they ASKED to be. Without this the register form's
        // Student/Teacher toggle was purely decorative: applicants chose Teacher,
        // silently became students, and vanished from the Create Class lecturer
        // list with no trace of the intent. An admin grants the role deliberately
        // from the approvals screen, so the privilege-escalation guard above holds.
        requestedRole: parsed.data.role ?? "STUDENT",
        passwordHash,
        // Signing up no longer waits on an admin. Course access is what is
        // actually gated now — joining a class is a request an admin approves —
        // so a second gate in front of the account only kept people out of a
        // platform they could not use anyway. The approval field stays so an
        // admin can still revoke a specific account.
        approvedAt: new Date(),
        language: parsed.data.language ?? "FA",
        timezone: parsed.data.timezone ?? "Asia/Kabul",
      },
      select: {
        id: true,
        email: true,
        role: true,
        approvedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        email: created.email,
        role: created.role,
        approvedAt: created.approvedAt ? created.approvedAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    // Prisma unique violation for email.
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ message: "Email already registered" }, { status: 409 });
    }

    return NextResponse.json({ message: "Registration failed" }, { status: 500 });
  }
}

