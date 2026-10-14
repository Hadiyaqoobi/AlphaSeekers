import { NextRequest, NextResponse } from "next/server";

import { getClassAttendanceSummary } from "@/lib/platform/store";
import { can, getAccessControl } from "@/lib/security/permissions";
import { getSessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";

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

    // IDOR guard: a teacher may only read attendance for a class they teach.
    // Staff need classes.view — role=ADMIN alone is every scoped employee.
    const isStaff = user.role === "ADMIN" && can(await getAccessControl(), "classes.view");
    if (!isStaff) {
        const klass = await prisma.class.findUnique({ where: { id: params.id }, select: { teacherId: true } });
        if (!klass) return NextResponse.json({ message: "Class not found" }, { status: 404 });
        if (klass.teacherId !== user.id) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const data = await getClassAttendanceSummary(params.id);
    return NextResponse.json(data);
}
