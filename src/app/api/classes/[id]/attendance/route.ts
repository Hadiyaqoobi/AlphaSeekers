import { NextRequest, NextResponse } from "next/server";

import { getClassAttendanceSummary } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type RouteContext = { params: { id: string } };

/**
 * GET /api/classes/[id]/attendance
 * Returns attendance summary for all sessions in a class.
 * Teachers and admins only.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
    const user = await getSessionUser();
    if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await getClassAttendanceSummary(params.id);
    return NextResponse.json(data);
}
