import { NextRequest, NextResponse } from "next/server";

import { createClassFromBody, parseCreateClassBody } from "@/lib/platform/class-create";
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

    // Same validation as POST /api/admin/classes (src/lib/platform/class-create.ts):
    // an unreadable day/time is a 400 with a clear message, never a silent default.
    const parsed = parseCreateClassBody(await request.json().catch(() => null));
    if (!parsed.ok) {
        return NextResponse.json(parsed.body, { status: 400 });
    }

    const created = await createClassFromBody(parsed.data);
    if (!created.ok) {
        return NextResponse.json({ message: created.message }, { status: created.status });
    }

    // Class fields at the top level as well, so both create endpoints answer with
    // the same shape (the shared form reads either).
    return NextResponse.json({ ...created.result.class, ...created.result }, { status: 201 });
}
