import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/passwords";
import { encryptPhone } from "@/lib/security/phone-crypto";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(6).max(72),
  role: z.enum(["STUDENT", "TEACHER"]),
  phone: z.string().trim().min(6).max(32).optional(),
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
    return NextResponse.json({ message: "Invalid registration payload" }, { status: 400 });
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

