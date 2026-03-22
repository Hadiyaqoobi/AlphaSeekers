import { NextRequest, NextResponse } from "next/server";

import { getSessionAttendance, markAttendance } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type RouteContext = { params: { sessionId: string } };

/**
 * GET /api/classes/sessions/[sessionId]/attendance
 * Returns the attendance sheet for a session (all enrolled students + status).
 * Teachers and admins only.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
    const user = await getSessionUser();
    if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await getSessionAttendance(params.sessionId);
    if (!data) {
        return NextResponse.json({ message: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(data);
}

/**
 * POST /api/classes/sessions/[sessionId]/attendance
 * Mark attendance for a student. Body: { studentId, attended }
 * Teachers and admins only.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
    const user = await getSessionUser();
    if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.studentId !== "string" || typeof body.attended !== "boolean") {
        return NextResponse.json({ message: "Invalid payload: { studentId: string, attended: boolean }" }, { status: 400 });
    }

    const record = await markAttendance(params.sessionId, body.studentId, body.attended);
    return NextResponse.json(record);
}
