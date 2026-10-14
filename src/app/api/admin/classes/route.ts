import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { createClassFromBody, parseCreateClassBody } from "@/lib/platform/class-create";
import { listAdminClasses, parseInteger } from "@/lib/platform/store";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("classes.view");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const page = parseInteger(request.nextUrl.searchParams.get("page"), 1);
  const limit = parseInteger(request.nextUrl.searchParams.get("limit"), 10);
  const search = request.nextUrl.searchParams.get("search") ?? "";

  return NextResponse.json(await listAdminClasses({ page, limit, search }));
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("classes.create");
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  // Same validation and creation path as POST /api/staff/classes
  // (src/lib/platform/class-create.ts): one form, one rule for the class time.
  const parsed = parseCreateClassBody(await request.json().catch(() => null));

  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: 400 });
  }

  try {
    const created = await createClassFromBody(parsed.data);
    if (!created.ok) {
      return NextResponse.json({ message: created.message }, { status: created.status });
    }

    // Class fields stay at the top level (scripts read `id`), plus the shared
    // result: sessions, registrationUrl, scheduleIssue, invitedTeacher.
    return NextResponse.json({ ...created.result.class, ...created.result }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Foreign key violation — most likely an invalid teacherId.
      if (error.code === "P2003") {
        return NextResponse.json({ message: "Invalid teacherId." }, { status: 400 });
      }
      // Unique constraint violation.
      if (error.code === "P2002") {
        return NextResponse.json({ message: "A class with these details already exists." }, { status: 409 });
      }
    }

    console.error("[admin/classes] createClass failed:", error);
    return NextResponse.json({ message: "Failed to create class." }, { status: 500 });
  }
}
