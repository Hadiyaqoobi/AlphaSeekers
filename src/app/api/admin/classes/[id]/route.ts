import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { notifyTeacherOfNewClass } from "@/lib/platform/class-notify";
import { joinQuestionsSchema } from "@/lib/platform/join-questions";
import { parseRegistrationDeadline } from "@/lib/platform/registration-deadline";
import { archiveClass, deleteClassPermanently, updateClass } from "@/lib/platform/store";
import { prisma } from "@/lib/prisma";
import { formatWeeklySlots, parseWeeklySlotsStrict } from "@/lib/scheduling/weekly-slot";
import { recordAudit } from "@/lib/security/audit";
import { AccessError, requirePermission, requireSuperAdmin } from "@/lib/security/permissions";
import { getClientIp } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized } from "@/lib/security/session";

type Params = {
  params: { id: string };
};

// Strict allowlist — only editable scalar fields. Prevents mass-assignment: a
// classes.edit holder cannot smuggle nested relation ops (e.g. sessions.deleteMany)
// or inject non-URL text through the raw PATCH body. teacherId IS editable (a
// class's teacher could not be changed at all before), but only to an existing
// TEACHER account, and every change is written to the audit log.
const updateClassSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    subjectCategory: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    maxStudents: z.number().int().min(1).max(1000).optional(),
    durationMinutes: z.number().int().min(30).max(600).optional(),
    // Same strict rule as class creation: an unreadable day/time is a 400, and the
    // stored value is the canonical "Tue, Thu 6:00 PM" (Kabul) the scheduler reads.
    schedulePreference: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .transform((value, ctx) => {
        if (value === undefined) return undefined;
        const slots = parseWeeklySlotsStrict(value);
        if (!slots) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Choose one or more days and a time (Kabul), e.g. "Tue, Thu 6:00 PM".',
          });
          return z.NEVER;
        }
        return formatWeeklySlots(slots);
      }),
    teacherId: z.string().trim().min(1).max(100).optional(),
    language: z.string().trim().min(1).max(50).optional(),
    registrationFormUrl: z.string().trim().max(300).regex(/^(https?:\/\/.+)?$/, "must be a URL or blank").optional(),
    whatsappGroupUrl: z.string().trim().max(300).regex(/^(https?:\/\/.+)?$/, "must be a URL or blank").optional(),
    // Staff schedule every class; "MANUAL" (teacher sets the dates) is no longer offered.
    schedulingMode: z.literal("AUTO").optional(),
    // The class's own sign-up questions (ADR-0009); [] or null removes them all.
    // Answers already given stay with each enrolment.
    joinQuestions: joinQuestionsSchema.nullable().optional(),
    /**
     * Registration cutoff. A date-only "YYYY-MM-DD" keeps the whole named day
     * open (see parseRegistrationDeadline). Omitted = leave unchanged; null or
     * "" = clear it and reopen registration.
     */
    registrationDeadline: z
      .union([z.string().trim().max(40), z.null()])
      .optional()
      .transform((value, ctx) => {
        if (value === undefined) return undefined;
        const result = parseRegistrationDeadline(value);
        if (!result.ok) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
          return z.NEVER;
        }
        return result.value;
      }),
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
  const before = await prisma.class.findUnique({
    where: { id: params.id },
    select: { teacherId: true, name: true, schedulePreference: true, schedulingMode: true },
  });
  if (!before) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  const teacherChanged = parsed.data.teacherId !== undefined && parsed.data.teacherId !== before.teacherId;
  if (teacherChanged) {
    const teacher = await prisma.user.findUnique({ where: { id: parsed.data.teacherId }, select: { role: true } });
    if (!teacher || teacher.role !== "TEACHER") {
      return NextResponse.json({ message: "teacherId: choose a teacher from the list." }, { status: 400 });
    }
  }

  const updated = await updateClass(params.id, parsed.data);

  if (!updated) {
    return NextResponse.json({ message: "Class not found" }, { status: 404 });
  }

  if (teacherChanged) {
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "class.teacher_change",
      targetType: "Class",
      targetId: params.id,
      details: JSON.stringify({ from: before.teacherId, to: updated.teacherId }),
      ipAddress: getClientIp(request),
    });

    // The new teacher has to know, or the class waits on someone who never heard
    // of it. Best-effort: the change itself has already been saved.
    try {
      await notifyTeacherOfNewClass({
        classId: updated.id,
        className: updated.name,
        teacherId: updated.teacherId,
        schedulePreference: updated.schedulePreference,
        schedulingMode: updated.schedulingMode,
      });
    } catch (error) {
      console.error("[admin/classes] failed to notify the new teacher", params.id, error);
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  // Two modes on one verb:
  //   ?mode=permanent → HARD delete (irreversible) — SUPER ADMIN ONLY, by
  //                     explicit decision: destroying a class and every
  //                     enrolment, session and attendance record with it stays
  //                     with the three account owners.
  //   (default)       → archive (soft, recoverable) — any classes.delete holder.
  //
  // Non-super admins are told this in the danger zone rather than having the
  // control hidden, which is what made deletion look broken to the team.
  const permanent = request.nextUrl.searchParams.get("mode") === "permanent";

  let access;
  try {
    access = permanent ? await requireSuperAdmin() : await requirePermission("classes.delete");
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
