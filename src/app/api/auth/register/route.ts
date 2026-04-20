import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/passwords";
import { encryptPhone } from "@/lib/security/phone-crypto";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { stripHtml } from "@/lib/security/sanitize";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(120, "Name is too long.")
    .transform(stripHtml)
    .pipe(z.string().min(1, "Name must contain visible text.")),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(72, "Password is too long."),
  role: z.enum(["STUDENT", "TEACHER"], {
    message: "Please choose Student or Teacher.",
  }),
  phone: z
    .string()
    .trim()
    .min(6, "Phone number is too short.")
    .max(32, "Phone number is too long.")
    .optional(),
  language: z.enum(["FA", "EN"]).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`register:${ip}`);

  if (!rl.allowed) {
    return NextResponse.json(
      { message: "Too many registration attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
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

  const email = parsed.data.email.toLowerCase();

  try {
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        phone: parsed.data.phone ? encryptPhone(parsed.data.phone) : null,
        role: parsed.data.role,
        passwordHash: hashPassword(parsed.data.password),
        approvedAt: null,
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

