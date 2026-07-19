import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createClassWithSession } from "@/lib/platform/store";
import { deliverWithFallback } from "@/lib/integrations/notifications";
import { guardPermission } from "@/lib/security/api-guard";
import { hashPassword } from "@/lib/security/passwords";
import { encryptPhone } from "@/lib/security/phone-crypto";
import { getSessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const user = await getSessionUser();

    if (!user || user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ message: "Staff classes endpoint ready" });
}

export async function POST(request: NextRequest) {
    const g = await guardPermission("classes.create");
    if (!g.ok) return g.response;

    const body = await request.json();

    const requiredFields = ["name", "subjectCategory", "description", "schedulePreference"];

    for (const field of requiredFields) {
        if (!body[field] || String(body[field]).trim().length === 0) {
            return NextResponse.json({ message: `Missing required field: ${field}` }, { status: 400 });
        }
    }

    // Resolve teacher ID — either existing teacher or invite new one
    let teacherId: string;

    if (body.newTeacherEmail && body.newTeacherName) {
        const email = String(body.newTeacherEmail).trim().toLowerCase();
        const name = String(body.newTeacherName).trim();

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email } });

        if (existing) {
            if (existing.role !== "TEACHER") {
                return NextResponse.json(
                    { message: `${email} already has an account with role ${existing.role}. Cannot assign as teacher.` },
                    { status: 400 },
                );
            }
            teacherId = existing.id;
        } else {
            // Create new teacher account with temp password
            const tempPassword = crypto.randomBytes(6).toString("base64url");
            const newTeacher = await prisma.user.create({
                data: {
                    name,
                    email,
                    passwordHash: await hashPassword(tempPassword),
                    phone: body.newTeacherPhone ? encryptPhone(String(body.newTeacherPhone).trim()) : null,
                    role: "TEACHER",
                    language: "FA",
                    timezone: "Asia/Kabul",
                    approvedAt: new Date(),
                },
            });

            teacherId = newTeacher.id;

            // Send onboarding notification with credentials + availability link
            const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3005";
            const onboardingContent =
                `Welcome to AlphaSeekers, ${name}!\n` +
                `Your account has been created.\n` +
                `Email: ${email}\n` +
                `Temporary password: ${tempPassword}\n` +
                `Please log in and set your availability: ${baseUrl}/fa/teacher/availability\n` +
                `Change your password after first login.`;

            deliverWithFallback(
                { userId: newTeacher.id, email: newTeacher.email, phone: newTeacher.phone, telegramChatId: newTeacher.telegramChatId, pushSubscription: newTeacher.pushSubscription },
                onboardingContent,
            ).catch((err) => {
                console.error("Failed to send teacher onboarding notification:", err);
            });
        }
    } else if (body.teacherId) {
        teacherId = String(body.teacherId).trim();
    } else {
        return NextResponse.json({ message: "Missing required field: teacherId or newTeacherEmail" }, { status: 400 });
    }

    const result = await createClassWithSession({
        name: String(body.name).trim(),
        subjectCategory: String(body.subjectCategory).trim(),
        description: String(body.description).trim(),
        teacherId,
        maxStudents: Math.max(1, Number(body.maxStudents) || 80),
        durationMinutes: Math.max(30, Number(body.durationMinutes) || 60),
        schedulePreference: String(body.schedulePreference).trim(),
        language: String(body.language || "Dari").trim(),
        registrationFormUrl: body.registrationFormUrl ? String(body.registrationFormUrl).trim() : undefined,
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3005";
    const registrationUrl = `${baseUrl}/fa/classes/${result.class.id}`;

    return NextResponse.json(
        {
            ...result,
            registrationUrl,
        },
        { status: 201 },
    );
}
