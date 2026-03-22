import { NextRequest, NextResponse } from "next/server";

import { createClass, listAdminClasses, parseInteger } from "@/lib/platform/store";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET(request: NextRequest) {
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
  const user = await getSessionUser();

  if (!user) {
    return unauthorized();
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ message: "Admin access only" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    subjectCategory?: string;
    description?: string;
    teacherId?: string;
    maxStudents?: number;
    durationMinutes?: number;
    schedulePreference?: string;
    language?: string;
  };

  if (
    !body.name ||
    !body.subjectCategory ||
    !body.description ||
    !body.teacherId ||
    !body.maxStudents ||
    !body.schedulePreference
  ) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  const durationMinutes = Math.max(30, Math.floor(body.durationMinutes ?? 60));

  const created = await createClass({
    name: body.name,
    subjectCategory: body.subjectCategory,
    description: body.description,
    teacherId: body.teacherId,
    maxStudents: body.maxStudents,
    durationMinutes,
    schedulePreference: body.schedulePreference,
    language: body.language ?? "Dari",
  });

  return NextResponse.json(created, { status: 201 });
}
