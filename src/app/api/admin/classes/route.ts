import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClass, listAdminClasses, parseInteger } from "@/lib/platform/store";
import { resolveTeacherId } from "@/lib/platform/teacher-invite";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized } from "@/lib/security/session";

const createClassSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    subjectCategory: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(5000),
    // Either an existing teacherId OR a new teacher's name+email (invite). Enforced by .refine below.
    teacherId: z.string().trim().min(1).max(100).optional(),
    newTeacherName: z.string().trim().min(2).max(120).optional(),
    newTeacherEmail: z.string().trim().email().max(200).optional(),
    newTeacherPhone: z.string().trim().max(40).optional(),
    maxStudents: z.number().int().min(1).max(1000),
    durationMinutes: z.number().int().min(30).max(600).optional(),
    schedulePreference: z.string().trim().min(1).max(200),
    language: z.string().trim().min(1).max(50).optional(),
    schedulingMode: z.enum(["AUTO", "MANUAL"]).optional(),
  })
  .refine((d) => Boolean(d.teacherId) || Boolean(d.newTeacherName && d.newTeacherEmail), {
    message: "Provide an existing teacher or a new teacher's name and email.",
    path: ["teacherId"],
  });

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

  const raw = await request.json().catch(() => null);
  const parsed = createClassSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid class payload",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Resolve the instructor: existing teacher, or invite a new one (creates the
  // account + emails onboarding). Same helper the staff create route uses.
  const resolved = await resolveTeacherId({
    teacherId: input.teacherId,
    newTeacherName: input.newTeacherName,
    newTeacherEmail: input.newTeacherEmail,
    newTeacherPhone: input.newTeacherPhone,
  });

  if (!resolved.ok) {
    return NextResponse.json({ message: resolved.message }, { status: resolved.status });
  }

  try {
    const created = await createClass({
      name: input.name,
      subjectCategory: input.subjectCategory,
      description: input.description,
      teacherId: resolved.teacherId,
      maxStudents: input.maxStudents,
      durationMinutes: input.durationMinutes ?? 60,
      schedulePreference: input.schedulePreference,
      language: input.language ?? "Dari",
      schedulingMode: input.schedulingMode ?? "AUTO",
    });

    return NextResponse.json({ ...created, invitedTeacher: resolved.invited }, { status: 201 });
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
