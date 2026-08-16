import { NextRequest, NextResponse } from "next/server";

import { createClassWithSession } from "@/lib/platform/store";
import { normaliseHttpUrl } from "@/lib/security/safe-url";
import { resolveTeacherId } from "@/lib/platform/teacher-invite";
import { guardPermission } from "@/lib/security/api-guard";
import { getSessionUser } from "@/lib/security/session";

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

    // Optional scheduling mode: AUTO (default) lets the auto-scheduler create
    // sessions; MANUAL means the instructor sets the session times themselves.
    if (
        body.schedulingMode !== undefined &&
        body.schedulingMode !== "AUTO" &&
        body.schedulingMode !== "MANUAL"
    ) {
        return NextResponse.json({ message: "schedulingMode must be AUTO or MANUAL" }, { status: 400 });
    }
    const schedulingMode: "AUTO" | "MANUAL" = body.schedulingMode === "MANUAL" ? "MANUAL" : "AUTO";

    // Resolve the instructor: existing teacher, or invite a new one (creates the
    // account + emails onboarding credentials). Shared with /api/admin/classes.
    const resolved = await resolveTeacherId({
        teacherId: body.teacherId,
        newTeacherName: body.newTeacherName,
        newTeacherEmail: body.newTeacherEmail,
        newTeacherPhone: body.newTeacherPhone,
    });

    if (!resolved.ok) {
        return NextResponse.json({ message: resolved.message }, { status: resolved.status });
    }

    const teacherId = resolved.teacherId;

    const result = await createClassWithSession({
        name: String(body.name).trim(),
        subjectCategory: String(body.subjectCategory).trim(),
        description: String(body.description).trim(),
        teacherId,
        maxStudents: Math.max(1, Number(body.maxStudents) || 80),
        durationMinutes: Math.max(30, Number(body.durationMinutes) || 60),
        schedulePreference: String(body.schedulePreference).trim(),
        language: String(body.language || "Dari").trim(),
        // Both end up in an href (the public class card, the student welcome),
        // so anything that is not http(s) is dropped rather than stored.
        registrationFormUrl: normaliseHttpUrl(body.registrationFormUrl) ?? undefined,
        whatsappGroupUrl: normaliseHttpUrl(body.whatsappGroupUrl) ?? undefined,
        schedulingMode,
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
