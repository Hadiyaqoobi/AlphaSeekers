import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { archiveClass, updateClass } from "@/lib/platform/store";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized } from "@/lib/security/session";

type Params = {
  params: { id: string };
};

// Strict allowlist — only editable scalar fields. Prevents mass-assignment: a
// classes.edit holder cannot smuggle nested relation ops (e.g. sessions.deleteMany),
// reassign teacherId, or inject non-URL text through the raw PATCH body.
const updateClassSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    subjectCategory: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    maxStudents: z.number().int().min(1).max(1000).optional(),
    durationMinutes: z.number().int().min(30).max(600).optional(),
    schedulePreference: z.string().trim().min(1).max(200).optional(),
    language: z.string().trim().min(1).max(50).optional(),
    registrationFormUrl: z.string().trim().max(300).regex(/^(https?:\/\/.+)?$/, "must be a URL or blank").optional(),
    whatsappGroupUrl: z.string().trim().max(300).regex(/^(https?:\/\/.+)?$/, "must be a URL or blank").optional(),
    schedulingMode: z.enum(["AUTO", "MANUAL"]).optional(),
  })
  .strict();

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requirePermission("classes.edit");
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

  const parsed = updateClassSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid update", errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }
  const updated = await updateClass(params.id, parsed.data);

  if (!updated) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    await requirePermission("classes.delete");
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

  const archived = await archiveClass(params.id);

  if (!archived) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Class archived", class: archived });
}
