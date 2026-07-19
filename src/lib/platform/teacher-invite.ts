import crypto from "node:crypto";

import { deliverWithFallback } from "@/lib/integrations/notifications";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/passwords";
import { encryptPhone } from "@/lib/security/phone-crypto";

export type TeacherResolution =
  | { ok: true; teacherId: string; invited: boolean }
  | { ok: false; status: number; message: string };

/**
 * Resolve the instructor for a new class: either reuse an existing `teacherId`,
 * or INVITE a brand-new teacher by name + email — creating the (auto-approved)
 * TEACHER account and emailing them onboarding credentials plus a link to set
 * their availability.
 *
 * Shared by the admin (/api/admin/classes) and staff (/api/staff/classes)
 * create-class routes so the invite behaviour is identical on both surfaces.
 * Never throws for the expected validation cases — returns
 * { ok: false, status, message } instead. Onboarding delivery is fire-and-forget
 * (email / telegram / push, best-effort) so a notification hiccup never blocks
 * class creation.
 */
export async function resolveTeacherId(input: {
  teacherId?: string | null;
  newTeacherName?: string | null;
  newTeacherEmail?: string | null;
  newTeacherPhone?: string | null;
  locale?: string;
}): Promise<TeacherResolution> {
  const name = input.newTeacherName?.trim();
  const email = input.newTeacherEmail?.trim().toLowerCase();

  if (name && email) {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role !== "TEACHER") {
        return {
          ok: false,
          status: 400,
          message: `${email} already has an account with role ${existing.role}. Cannot assign as teacher.`,
        };
      }
      return { ok: true, teacherId: existing.id, invited: false };
    }

    const tempPassword = crypto.randomBytes(6).toString("base64url");
    const newTeacher = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(tempPassword),
        phone: input.newTeacherPhone ? encryptPhone(String(input.newTeacherPhone).trim()) : null,
        role: "TEACHER",
        language: "FA",
        timezone: "Asia/Kabul",
        approvedAt: new Date(),
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3005";
    const locale = input.locale === "en" ? "en" : "fa";
    const onboardingContent =
      `Welcome to AlphaSeekers, ${name}!\n` +
      `Your account has been created.\n` +
      `Email: ${email}\n` +
      `Temporary password: ${tempPassword}\n` +
      `Please log in and set your availability: ${baseUrl}/${locale}/teacher/availability\n` +
      `Change your password after first login.`;

    deliverWithFallback(
      {
        userId: newTeacher.id,
        email: newTeacher.email,
        phone: newTeacher.phone,
        telegramChatId: newTeacher.telegramChatId,
        pushSubscription: newTeacher.pushSubscription,
      },
      onboardingContent,
    ).catch((err) => {
      console.error("[teacher-invite] failed to send onboarding notification:", err);
    });

    return { ok: true, teacherId: newTeacher.id, invited: true };
  }

  if (input.teacherId?.trim()) {
    return { ok: true, teacherId: input.teacherId.trim(), invited: false };
  }

  return {
    ok: false,
    status: 400,
    message: "Provide an existing teacher or a new teacher's name and email.",
  };
}
