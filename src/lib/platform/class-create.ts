/**
 * ONE validation + creation path for "post a class", shared by POST
 * /api/staff/classes and POST /api/admin/classes.
 *
 * The two endpoints used to validate differently: the admin one took a free-text
 * schedule that silently became Saturday 5:00 PM whenever it was typed in any
 * other shape ("6pm", Dari), the staff one dropped fields its form collected. Now
 * both accept the same body, reject an unreadable day/time with a clear 400, and
 * create the class the same way (createClassWithSession: the posted Kabul time is
 * the time used, see src/lib/scheduling/weekly-slot.ts).
 */
import { z } from "zod";

import { createClassWithSession } from "@/lib/platform/db-store";
import { joinQuestionsSchema } from "@/lib/platform/join-questions";
import { prisma } from "@/lib/prisma";
import { parseRegistrationDeadline } from "@/lib/platform/registration-deadline";
import { resolveTeacherId } from "@/lib/platform/teacher-invite";
import { formatWeeklySlots, parseWeeklySlotsStrict, slotsFromDaysAndTime } from "@/lib/scheduling/weekly-slot";
import { normaliseHttpUrl } from "@/lib/security/safe-url";

const DAY_TIME_HINT =
  'Choose one or more days and a time (Kabul), e.g. days ["Tue", "Thu"] and time "18:00", or schedule "Tue, Thu 6:00 PM".';

/** Optional http(s) link; blank = not set. Anything else is a 400, not silently dropped. */
const optionalLink = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const safe = normaliseHttpUrl(value);
    if (!safe) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a link starting with https://" });
      return z.NEVER;
    }
    return safe;
  });

export const createClassSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    subjectCategory: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(5000),
    // Either an existing teacherId OR a new teacher's name+email (invite). Enforced by .refine below.
    teacherId: z.string().trim().min(1).max(100).optional(),
    newTeacherName: z.string().trim().min(2).max(120).optional(),
    newTeacherEmail: z.string().trim().email().max(200).optional(),
    newTeacherPhone: z.string().trim().max(40).optional(),
    maxStudents: z.coerce.number().int().min(1).max(1000).default(50),
    durationMinutes: z.coerce.number().int().min(30).max(600).default(60),
    // The class time, Kabul wall clock: the ticked days + one 24h time (the form),
    // a single day + time (older clients), or one "Tue, Thu 6:00 PM" string
    // (scripts). One of them is required. Each day is booked as its own session.
    days: z.array(z.string().trim().max(20)).max(7).optional(),
    day: z.string().trim().max(20).optional(),
    time: z.string().trim().max(10).optional(),
    schedulePreference: z.string().trim().max(200).optional(),
    language: z.string().trim().min(1).max(50).default("Dari"),
    whatsappGroupUrl: optionalLink,
    // The teacher's OWN optional Google Form; students see it after they join.
    registrationFormUrl: optionalLink,
    // Staff set every date and the teacher only receives the link (decided
    // 2026-10-14), so a class can no longer be handed to the teacher to schedule.
    schedulingMode: z.literal("AUTO").default("AUTO"),
    // The class's own sign-up questions, shown on its join page (ADR-0009).
    joinQuestions: joinQuestionsSchema.optional(),
    /**
     * Registration cutoff. A date-only "YYYY-MM-DD" keeps the whole named day
     * open (see parseRegistrationDeadline). Omitted, null or "" = open.
     */
    registrationDeadline: z
      .union([z.string().trim().max(40), z.null()])
      .optional()
      .transform((value, ctx) => {
        const result = parseRegistrationDeadline(value);
        if (!result.ok) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
          return z.NEVER;
        }
        return result.value;
      }),
  })
  .refine((d) => Boolean(d.teacherId) || Boolean(d.newTeacherName && d.newTeacherEmail), {
    message: "Provide an existing teacher or a new teacher's name and email.",
    path: ["teacherId"],
  })
  .transform((d, ctx) => {
    const days = d.days ?? (d.day ? [d.day] : []);
    const slots =
      d.days || d.day || d.time ? slotsFromDaysAndTime(days, d.time ?? "") : parseWeeklySlotsStrict(d.schedulePreference);
    if (!slots) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: DAY_TIME_HINT, path: ["schedulePreference"] });
      return z.NEVER;
    }
    // Stored in ONE canonical form so the scheduler, pages and messages agree.
    return { ...d, schedulePreference: formatWeeklySlots(slots) };
  });

export type CreateClassBody = z.infer<typeof createClassSchema>;

export type ParsedCreateClass =
  | { ok: true; data: CreateClassBody }
  | { ok: false; body: { message: string; errors: Array<{ field: string; message: string }> } };

export function parseCreateClassBody(raw: unknown): ParsedCreateClass {
  const parsed = createClassSchema.safeParse(raw ?? {});
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors = parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
  // Lead with the first concrete problem so a volunteer sees what to fix, not
  // just "invalid payload".
  const first = errors[0];
  return {
    ok: false,
    body: {
      message: first ? `${first.field ? `${first.field}: ` : ""}${first.message}` : "Invalid class details.",
      errors,
    },
  };
}

/** Resolve (or invite) the teacher, create the class, and build the share link. */
export async function createClassFromBody(data: CreateClassBody) {
  const resolved = await resolveTeacherId({
    teacherId: data.teacherId,
    newTeacherName: data.newTeacherName,
    newTeacherEmail: data.newTeacherEmail,
    newTeacherPhone: data.newTeacherPhone,
  });
  if (!resolved.ok) {
    return { ok: false as const, status: resolved.status, message: resolved.message };
  }

  // An existing teacherId must be a real TEACHER account (it was only checked by
  // the foreign key before, so a student's or admin's id was accepted).
  const teacher = await prisma.user.findUnique({ where: { id: resolved.teacherId }, select: { role: true } });
  if (!teacher || teacher.role !== "TEACHER") {
    return { ok: false as const, status: 400, message: "teacherId: choose a teacher from the list." };
  }

  const result = await createClassWithSession({
    name: data.name,
    subjectCategory: data.subjectCategory,
    description: data.description,
    teacherId: resolved.teacherId,
    maxStudents: data.maxStudents,
    durationMinutes: data.durationMinutes,
    schedulePreference: data.schedulePreference,
    language: data.language,
    registrationFormUrl: data.registrationFormUrl,
    whatsappGroupUrl: data.whatsappGroupUrl,
    registrationDeadline: data.registrationDeadline,
    schedulingMode: data.schedulingMode,
    joinQuestions: data.joinQuestions,
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3005";
  // The PUBLIC join page, not /classes/[id]: this is the link staff send to
  // students, so it must work for someone who is not signed in. /join/[classId]
  // creates their account and enrols them in one step.
  const registrationUrl = `${baseUrl}/fa/join/${result.class.id}`;

  return { ok: true as const, result: { ...result, registrationUrl, invitedTeacher: resolved.invited } };
}
