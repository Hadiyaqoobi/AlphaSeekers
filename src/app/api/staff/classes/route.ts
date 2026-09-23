import { NextRequest, NextResponse } from "next/server";

import { createClassWithSession } from "@/lib/platform/store";
import { normaliseHttpUrl } from "@/lib/security/safe-url";
import { parseRegistrationDeadline } from "@/lib/platform/registration-deadline";
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

    // Optional registration cutoff. Rejected rather than silently dropped: a
    // deadline the teacher believes they set, but which never saved, is worse
    // than a 400.
    const deadline = parseRegistrationDeadline(body.registrationDeadline);
    if (!deadline.ok) {
        return NextResponse.json({ message: deadline.message }, { status: 400 });
    }

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
        registrationDeadline: deadline.value,
        schedulingMode,
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3005";
    // The PUBLIC join page, not /classes/[id].
    //
    // This is the link staff copy and send to students, so it has to work for
    // someone who is not signed in. /classes/[id] redirects anyone signed-out to
    // /login — so the person who received the link hit a wall, could not see the
    // class, and had no way in. /join/[classId] is the one-form page that creates
    // their account and enrols them in a single step.
    const registrationUrl = `${baseUrl}/fa/join/${result.class.id}`;

    return NextResponse.json(
        {
            ...result,
            registrationUrl,
        },
        { status: 201 },
    );
}
