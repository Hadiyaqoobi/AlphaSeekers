import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { archiveClass, deleteClassPermanently, updateClass } from "@/lib/platform/store";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getClientIp } from "@/lib/security/rate-limit";
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

export async function DELETE(request: NextRequest, { params }: Params) {
  // Two modes on one verb, both behind classes.delete:
  //   ?mode=permanent → HARD delete (irreversible), type-the-class-name confirm.
  //   (default)       → archive (soft, recoverable).
  //
  // Permanent delete used to require SUPER ADMIN. That left four of the seven
  // admins seeing archive only — the danger zone hides the delete block
  // entirely — so they archived their test classes, the rows stayed, and the
  // team reported deletion as broken. classes.delete is already the permission
  // that means "may destroy a class"; gating the irreversible half on a
  // different axis just made the capability unreachable for the people asked to
  // use it. The type-the-name confirmation remains the guard against accidents.
  const permanent = request.nextUrl.searchParams.get("mode") === "permanent";

  let access;
  try {
    access = await requirePermission("classes.delete");
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

  if (permanent) {
    const deleted = await deleteClassPermanently(params.id);
    if (!deleted) {
      return NextResponse.json({ message: "Class not found" }, { status: 404 });
    }

    // Irreversible and now available to every admin, so leave a trace of who
    // did it. Previously nothing recorded class deletions at all.
    await recordAudit({
      actorId: access.userId,
      actorEmail: access.email,
      action: "class.delete",
      targetType: "Class",
      targetId: params.id,
      details: "permanent delete",
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ message: "Class permanently deleted", id: deleted.id });
  }

  const archived = await archiveClass(params.id);

  if (!archived) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Class archived", class: archived });
}
