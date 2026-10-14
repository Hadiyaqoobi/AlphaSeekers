import type { UserRole } from "@prisma/client";
import { Prisma, ClassStatus, EnrollmentStatus, MeetLinkStatus, NotificationChannel, NotificationStatus, SchedulerJobStatus } from "@prisma/client";

import { DEMO_USERS } from "@/lib/constants";
import { cancelMeetEvent, generateMeetLink, type MeetGenerationResult } from "@/lib/integrations/meet";
import {
  deliverWithFallback,
  deliveryNeedsRetry,
  landedOnRealChannel,
  type NotificationDelivery,
  type NotificationTarget,
} from "@/lib/integrations/notifications";
import { classCatalog } from "@/lib/mock-data";
import { notifyTeacherOfNewClass } from "@/lib/platform/class-notify";
import { openAnswers, sealAnswers } from "@/lib/platform/join-answers";
import { checkAnswers, readJoinQuestions, type JoinQuestion } from "@/lib/platform/join-questions";
import { prisma } from "@/lib/prisma";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { classSpanMinutes, planAutoSlot, type SlotProblem } from "@/lib/scheduling/weekly-slot";

type Role = UserRole;

type ClassListParams = {
  page?: number;
  limit?: number;
  search?: string;
};

type CreateClassInput = {
  name: string;
  subjectCategory: string;
  description: string;
  teacherId: string;
  maxStudents: number;
  durationMinutes: number;
  schedulePreference: string;
  language: string;
  registrationFormUrl?: string;
  whatsappGroupUrl?: string;
  /** Last moment a student may request to join. null/undefined = open indefinitely. */
  registrationDeadline?: Date | null;
  // AUTO (default) = availability-driven auto-scheduler creates sessions.
  // MANUAL = the instructor sets/confirms exact session times; class creation
  // does NOT auto-create a session and the auto-scheduler skips this class.
  schedulingMode?: "AUTO" | "MANUAL";
  /** The class's own sign-up questions (ADR-0009). Empty or null = none. */
  joinQuestions?: JoinQuestion[] | null;
};

type UpdateClassInput = Partial<CreateClassInput>;

/** Json? column value: an empty list is stored as "no questions", not []. */
function joinQuestionsColumn(questions: JoinQuestion[] | null | undefined) {
  if (questions === undefined) return undefined;
  return questions && questions.length > 0 ? (questions as Prisma.InputJsonValue) : Prisma.DbNull;
}

type CreateOpportunityInput = {
  title: string;
  type: "SCHOLARSHIP" | "JOB" | "INTERNSHIP" | "GRANT";
  description: string;
  deadline: string;
  externalUrl: string;
};

type CreateWebinarInput = {
  title: string;
  description: string;
  startsAt: string;
  meetLink: string;
  language: string;
};

type CreateLibraryInput = {
  title: string;
  author: string;
  category: string;
  // Both are optional and the schema allows null: a resource is reachable by an
  // uploaded file, an external link, or both. The API rejects having neither.
  fileUrl?: string;
  fileSize: number;
  externalUrl?: string;
};

type CreateMaterialInput = {
  classId: string;
  title: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
};

// Default page size when a caller does not request one. The hard cap is separate
// so admin screens can page through large tables (e.g. 10k users) in bigger chunks.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
// Bounded default/cap for per-user notification history (avoid returning a user's
// entire lifetime of notifications).
const DEFAULT_NOTIFICATION_LIMIT = 50;
const MAX_NOTIFICATION_LIMIT = 100;
// Asia/Kabul is UTC+04:30 with no DST. All schedule/availability wall-clock values
// on the platform are interpreted in this timezone (see nextWeekdayDate).
const KABUL_OFFSET_MINUTES = 4 * 60 + 30;
// Bounded concurrency for fanning out external notification deliveries.
const DELIVERY_CONCURRENCY = 10;
// Fixed key for the scheduler's transaction advisory lock (serializes overlapping
// cron invocations so they claim disjoint work slices instead of duplicating them).
const SCHEDULER_ADVISORY_LOCK_KEY = 918273645;
const FREE_MEET_SEGMENT_MINUTES = 60;
const SEGMENT_BREAK_MINUTES = 10;
const SEGMENT_TRANSITION_WINDOW_MINUTES = 15;
const REMINDER_LEAD_MINUTES = 60;
// Must be WIDER than the cron pulse interval, or sessions fall between runs and
// their reminder is silently never sent. The pulse is HOURLY (see render.yaml —
// the database scales to zero between pulses to keep the Neon bill near $2/mo),
// so this is 70 to leave margin. With a 60-minute lead that means a reminder
// lands 25-95 minutes before class. Sending is deduped per session+recipient,
// so a session caught by two consecutive pulses is only notified once.
const REMINDER_WINDOW_MINUTES = 70;
const SEED_SENTINEL_EMAIL = DEMO_USERS[0].email;
const PLACEHOLDER_DATABASE_URL = "postgresql://user:password@localhost:5432/alphaseekers";

let seeded = false;

function parseScheduleTime(schedulePreference: string) {
  const match = schedulePreference.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (!match) {
    return { hour: 17, minute: 0 };
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hour < 12) {
    hour += 12;
  }

  if (period === "AM" && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
}

function parseScheduleDay(schedulePreference: string) {
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const match = schedulePreference.match(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/);

  if (!match) {
    return 6;
  }

  return dayMap[match[1]];
}

/**
 * Compute the next occurrence of a weekly wall-clock time and return it as a true
 * UTC Date suitable for storage/comparison.
 *
 * CONVENTION: (dayOfWeek, hour, minute) are Asia/Kabul LOCAL wall-clock values —
 * this is what teachers pick and what schedule strings ("Sat 5:00 PM") mean.
 * Previously these were written straight into setUTCHours(), so a 5:00 PM Kabul
 * class was stored as 17:00 UTC (= 9:30 PM Kabul once rendered), shifting every
 * session by the 4h30 offset. We now interpret the wall-clock in Kabul time and
 * convert to UTC.
 *
 * Also fixes the old `% 7 || 7` bug: when today already IS the target weekday, the
 * `|| 7` forced scheduling a full week out even if the time had not yet passed.
 * We now allow same-day scheduling and only roll forward a week when the local
 * time is already in the past.
 */
function nextWeekdayDate(dayOfWeek: number, hour: number, minute: number) {
  const now = new Date();
  // Shift into Kabul-local space so getUTC*/setUTC* operate on Kabul wall clock.
  const nowLocal = new Date(now.getTime() + KABUL_OFFSET_MINUTES * 60 * 1000);
  const targetLocal = new Date(nowLocal);
  const daysToAdd = (dayOfWeek - nowLocal.getUTCDay() + 7) % 7;
  targetLocal.setUTCDate(nowLocal.getUTCDate() + daysToAdd);
  targetLocal.setUTCHours(hour, minute, 0, 0);
  // If the resulting local instant is not strictly in the future, roll a week.
  if (targetLocal.getTime() <= nowLocal.getTime()) {
    targetLocal.setUTCDate(targetLocal.getUTCDate() + 7);
  }
  // Convert the Kabul-local instant back to true UTC.
  return new Date(targetLocal.getTime() - KABUL_OFFSET_MINUTES * 60 * 1000);
}

function normalizeDurationMinutes(input: number | null | undefined) {
  const value = Number(input ?? FREE_MEET_SEGMENT_MINUTES);

  if (!Number.isFinite(value)) {
    return FREE_MEET_SEGMENT_MINUTES;
  }

  return Math.max(30, Math.floor(value));
}

function buildSegmentDurations(totalMinutes: number) {
  const normalized = normalizeDurationMinutes(totalMinutes);

  if (normalized <= FREE_MEET_SEGMENT_MINUTES) {
    return [normalized];
  }

  const segments: number[] = [];
  let remaining = normalized;

  while (remaining > 0) {
    const segment = Math.min(FREE_MEET_SEGMENT_MINUTES, remaining);
    segments.push(segment);
    remaining -= segment;
  }

  return segments;
}

function buildSegmentWindows(startDate: Date, totalMinutes: number) {
  const durations = buildSegmentDurations(totalMinutes);
  let cursor = new Date(startDate);

  return durations.map((segmentMinutes, index) => {
    const startTime = new Date(cursor);
    const endTime = new Date(cursor);
    endTime.setUTCMinutes(endTime.getUTCMinutes() + segmentMinutes);

    cursor = new Date(endTime);
    if (index < durations.length - 1) {
      cursor.setUTCMinutes(cursor.getUTCMinutes() + SEGMENT_BREAK_MINUTES);
    }

    return {
      startTime,
      endTime,
      segmentIndex: index + 1,
      segmentCount: durations.length,
    };
  });
}

function clampLimit(limit?: number) {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, limit ?? DEFAULT_PAGE_SIZE));
}

/**
 * Run an async mapper over `items` with a bounded number of in-flight promises.
 * Never rejects — each result is a PromiseSettledResult so a single failed
 * delivery cannot abort the batch. Used to fan out external notification sends.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const poolSize = Math.max(1, Math.min(limit, items.length));

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return results;
}

function normalizeSearch(input?: string) {
  return (input ?? "").trim();
}

function minuteToUtcDate(minute: number) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
}

function utcDateToMinute(date: Date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function formatDateTimeForUser(date: Date, timezone: string | null | undefined, language: "FA" | "EN") {
  const locale = language === "FA" ? "fa-AF" : "en-US";
  const timeZone = timezone && timezone.trim().length > 0 ? timezone : "Asia/Kabul";

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
}

function buildSessionReminderContent(input: {
  language: "FA" | "EN";
  timezone?: string | null;
  className: string;
  teacherName: string;
  startTime: Date;
  meetLink: string | null;
  continuation?: { startTime: Date; meetLink: string | null } | null;
}) {
  const when = formatDateTimeForUser(input.startTime, input.timezone, input.language);
  const joinText = input.meetLink ?? (input.language === "FA" ? "لینک در حال آماده‌سازی است" : "Meet link pending");

  if (input.language === "FA") {
    const base = `یادآوری: صنف ${input.className} یک ساعت بعد شروع می‌شود.\nاستاد: ${input.teacherName}\nزمان: ${when}\nلینک: ${joinText}`;
    if (!input.continuation) {
      return base;
    }

    const nextWhen = formatDateTimeForUser(input.continuation.startTime, input.timezone, input.language);
    const nextLink = input.continuation.meetLink ?? "لینک در حال آماده‌سازی است";
    return `${base}\nبعد از ${SEGMENT_BREAK_MINUTES} دقیقه استراحت، بخش بعدی در ${nextWhen} شروع می‌شود.\nلینک بعدی: ${nextLink}`;
  }

  // States the actual start time: the hourly pulse delivers this 25-95 minutes
  // ahead (see REMINDER_WINDOW_MINUTES), so "in 1 hour" was often wrong.
  const base = `Reminder: ${input.className} starts at ${when}.\nTeacher: ${input.teacherName}\nJoin: ${joinText}`;
  if (!input.continuation) {
    return base;
  }

  const nextWhen = formatDateTimeForUser(input.continuation.startTime, input.timezone, input.language);
  const nextLink = input.continuation.meetLink ?? "Meet link pending";
  return `${base}\nAfter a ${SEGMENT_BREAK_MINUTES}-minute break, the next segment starts at ${nextWhen}.\nNext link: ${nextLink}`;
}

function buildTeacherSessionReminderContent(input: {
  language: "FA" | "EN";
  timezone?: string | null;
  className: string;
  startTime: Date;
  meetLink: string | null;
  continuation?: { startTime: Date; meetLink: string | null } | null;
}) {
  const when = formatDateTimeForUser(input.startTime, input.timezone, input.language);
  const joinText = input.meetLink ?? (input.language === "FA" ? "لینک در حال آماده‌سازی است" : "Meet link pending");

  if (input.language === "FA") {
    const base = `یادآوری استاد: صنف ${input.className} یک ساعت بعد شروع می‌شود.\nزمان: ${when}\nلینک: ${joinText}`;
    if (!input.continuation) return base;
    const nextWhen = formatDateTimeForUser(input.continuation.startTime, input.timezone, input.language);
    const nextLink = input.continuation.meetLink ?? "لینک در حال آماده‌سازی است";
    return `${base}\nبعد از ${SEGMENT_BREAK_MINUTES} دقیقه استراحت، بخش بعدی در ${nextWhen} شروع می‌شود.\nلینک بعدی: ${nextLink}`;
  }

  const base = `Teacher reminder: Your class "${input.className}" starts at ${when}.\nJoin: ${joinText}`;
  if (!input.continuation) return base;
  const nextWhen = formatDateTimeForUser(input.continuation.startTime, input.timezone, input.language);
  const nextLink = input.continuation.meetLink ?? "Meet link pending";
  return `${base}\nAfter a ${SEGMENT_BREAK_MINUTES}-minute break, the next segment starts at ${nextWhen}.\nNext link: ${nextLink}`;
}

export async function isDatabaseAvailable() {
  const url = process.env.DATABASE_URL;

  if (!url || url.trim().length === 0 || url.includes(PLACEHOLDER_DATABASE_URL)) {
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function ensureBaseUsers() {
  const teacherNames = Array.from(new Set(classCatalog.map((item) => item.teacherName)));
  const approvedAt = new Date();

  await prisma.user.createMany({
    data: [
      {
        id: DEMO_USERS[0].id,
        name: DEMO_USERS[0].name,
        email: DEMO_USERS[0].email,
        role: "ADMIN" as const,
        timezone: "Asia/Kabul",
        language: "FA" as const,
        phone: "+93700000001",
      },
      {
        id: DEMO_USERS[1].id,
        name: DEMO_USERS[1].name,
        email: DEMO_USERS[1].email,
        role: "TEACHER" as const,
        timezone: "Asia/Kabul",
        language: "FA" as const,
        phone: "+93700000002",
      },
      {
        id: DEMO_USERS[2].id,
        name: DEMO_USERS[2].name,
        email: DEMO_USERS[2].email,
        role: "STUDENT" as const,
        timezone: "Asia/Kabul",
        language: "FA" as const,
        phone: "+93700000003",
      },
      ...teacherNames
        .filter((name) => name !== DEMO_USERS[1].name)
        .map((name, index) => ({
          id: `teacher_${index + 1}`,
          name,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, "") || `teacher${index + 1}`}@alphaseekers.org`,
          role: "TEACHER" as const,
          timezone: "Asia/Kabul",
          language: "FA" as const,
          phone: `+93700001${String(index + 1).padStart(2, "0")}`,
        })),
      ...Array.from({ length: 150 }).map((_, index) => ({
        id: `student_${index + 1}`,
        name: `Student ${index + 1}`,
        email: `student${index + 1}@alphaseekers.org`,
        role: "STUDENT" as const,
        timezone: "Asia/Kabul",
        language: "FA" as const,
        phone: `+937001${String(index + 1).padStart(5, "0")}`,
      })),
    ].map((user) => ({ ...user, approvedAt })),
    skipDuplicates: true,
  });
}

async function ensureBaseClasses() {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: { id: true, name: true },
  });

  const teacherMap = new Map(teachers.map((item) => [item.name, item.id]));

  await prisma.class.createMany({
    data: classCatalog.map((item) => ({
      id: item.id,
      name: item.name,
      subjectCategory: item.subjectCategory,
      description: `${item.name} class for Afghan girls.`,
      teacherId: teacherMap.get(item.teacherName) ?? DEMO_USERS[1].id,
      maxStudents: 80,
      durationMinutes: FREE_MEET_SEGMENT_MINUTES,
      schedulePreference: item.schedule,
      language: item.language,
      status: "ACTIVE",
    })),
    skipDuplicates: true,
  });
}

async function ensureBaseAvailability() {
  const hasAny = await prisma.teacherAvailability.findFirst();

  if (hasAny) {
    return;
  }

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const availability = teachers.flatMap((teacher, index) => [
    {
      teacherId: teacher.id,
      dayOfWeek: (index + 1) % 7,
      startTimeUTC: minuteToUtcDate(17 * 60),
      endTimeUTC: minuteToUtcDate(19 * 60),
    },
    {
      teacherId: teacher.id,
      dayOfWeek: (index + 3) % 7,
      startTimeUTC: minuteToUtcDate(15 * 60),
      endTimeUTC: minuteToUtcDate(17 * 60),
    },
  ]);

  await prisma.teacherAvailability.createMany({
    data: availability,
    skipDuplicates: true,
  });
}

async function ensureBaseEnrollmentsAndSessions() {
  const hasEnrollment = await prisma.enrollment.findFirst();

  if (!hasEnrollment) {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    const classes = await prisma.class.findMany({
      where: { status: ClassStatus.ACTIVE },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    const enrollmentRows = classes.flatMap((klass, classIndex) => {
      const targetCount = Math.min(25 + (classIndex % 16), students.length);

      return students.slice(classIndex, classIndex + targetCount).map((student) => ({
        studentId: student.id,
        classId: klass.id,
        status: EnrollmentStatus.ACTIVE,
      }));
    });

    if (enrollmentRows.length > 0) {
      await prisma.enrollment.createMany({
        data: enrollmentRows,
        skipDuplicates: true,
      });
    }
  }

  const hasSession = await prisma.session.findFirst();

  if (!hasSession) {
    const classes = await prisma.class.findMany({
      where: { status: ClassStatus.ACTIVE },
      select: { id: true, name: true, teacherId: true, schedulePreference: true, durationMinutes: true },
    });

    const sessionRowsNested = await Promise.all(
      classes.map(async (klass) => {
        const day = parseScheduleDay(klass.schedulePreference ?? "Sat 5:00 PM");
        const time = parseScheduleTime(klass.schedulePreference ?? "5:00 PM");
        const start = nextWeekdayDate(day, time.hour, time.minute);
        const windows = buildSegmentWindows(start, klass.durationMinutes);

        return Promise.all(
          windows.map(async (window) => {
            const meet = await generateMeetLink(klass.name, window.startTime.toISOString(), {
              endIso: window.endTime.toISOString(),
              teacherId: klass.teacherId,
            });

            return {
              classId: klass.id,
              startTime: window.startTime,
              endTime: window.endTime,
              meetLink: meet.link,
              meetLinkStatus: meet.status === "FAILED" ? MeetLinkStatus.FAILED : MeetLinkStatus.GENERATED,
              cancelled: false,
            };
          }),
        );
      }),
    );
    const sessionRows = sessionRowsNested.flat();

    if (sessionRows.length > 0) {
      await prisma.session.createMany({
        data: sessionRows,
        skipDuplicates: true,
      });
    }
  }
}

async function ensureSecondaryData() {
  const classRows = await prisma.class.findMany({
    where: { status: ClassStatus.ACTIVE },
    select: { id: true, name: true, teacherId: true },
    take: 8,
    orderBy: { id: "asc" },
  });

  const materialCount = await prisma.material.count();

  if (materialCount === 0 && classRows.length > 0) {
    await prisma.material.createMany({
      data: classRows.map((klass, index) => ({
        classId: klass.id,
        title: `${klass.name} - Week ${index + 1} Notes.pdf`,
        fileUrl: `https://example-r2.alphaseekers.org/materials/${klass.id}-week-${index + 1}.pdf`,
        fileSize: 350_000 + index * 40_000,
        uploadedBy: klass.teacherId,
      })),
    });
  }

  const webinarCount = await prisma.webinar.count();

  if (webinarCount === 0) {
    await prisma.webinar.createMany({
      data: [
        {
          title: "Career Planning for Afghan Girls",
          description: "Drop-in guidance session on scholarship and career pathways.",
          startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          meetLink: "https://meet.google.com/career-webinar-1",
          language: "Dari",
        },
        {
          title: "Mental Health and Study Habits",
          description: "Practical workshop for building healthy learning routines.",
          startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          meetLink: "https://meet.google.com/wellbeing-webinar-2",
          language: "Dari",
        },
      ],
    });
  }

  const opportunityCount = await prisma.opportunity.count();

  if (opportunityCount === 0) {
    await prisma.opportunity.createMany({
      data: [
        {
          title: "Global Girls Scholarship 2026",
          type: "SCHOLARSHIP",
          description: "Full scholarship for online undergraduate studies.",
          deadline: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          externalUrl: "https://example.org/scholarship",
        },
        {
          title: "Remote Internship - Translation Assistant",
          type: "INTERNSHIP",
          description: "Paid remote internship for bilingual students.",
          deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
          externalUrl: "https://example.org/internship",
        },
      ],
    });
  }

  const libraryCount = await prisma.libraryResource.count();

  if (libraryCount === 0) {
    await prisma.libraryResource.createMany({
      data: [
        {
          title: "English Grammar Essentials",
          author: "Open Learning Collective",
          category: "Language",
          fileUrl: "https://example-r2.alphaseekers.org/library/english-grammar.pdf",
          fileSize: 1_800_000,
        },
        {
          title: "Intro to Journalism",
          author: "Community Media Press",
          category: "Professional Skills",
          fileUrl: "https://example-r2.alphaseekers.org/library/journalism-intro.pdf",
          fileSize: 1_350_000,
        },
      ],
    });
  }
}

async function ensureApprovalDefaults() {
  const now = new Date();

  await prisma.user.updateMany({
    where: {
      approvedAt: null,
      OR: [
        { id: { in: DEMO_USERS.map((user) => user.id) } },
        { id: { startsWith: "teacher_" } },
        { id: { startsWith: "student_" } },
      ],
    },
    data: { approvedAt: now },
  });
}

/** Lower-cased host of a postgres URL, or null when it cannot be parsed. */
function databaseHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export async function ensureSeededData() {
  warnIfInsecureProductionConfig();

  if (seeded) {
    return;
  }

  // HARD GATE: never inject mock users/classes/sessions into a real database. Auto
  // seeding is demo-only. runtime.allowAutoSeed is false in production mode (and a
  // production build fails to boot if ALPHASEEKERS_AUTO_SEED is forced on — see
  // warnIfInsecureProductionConfig). Returning here BEFORE any write guarantees a
  // production DB is never touched by the seeder, even the approval backfill below.
  if (!runtime.allowAutoSeed) {
    seeded = true;
    return;
  }

  // Second gate, independent of mode: even with ALPHASEEKERS_AUTO_SEED=true, a
  // hosted Neon database is never seeded. Dev and prod have historically shared
  // one, so "it's only my dev server" is not a safe assumption. Seed a local
  // Postgres instead.
  const seedHost = databaseHost(process.env.DATABASE_URL);
  if (seedHost && (seedHost === "neon.tech" || seedHost.endsWith(".neon.tech"))) {
    console.error(
      `[AlphaSeekers] REFUSING to auto-seed demo data into ${seedHost}: ALPHASEEKERS_AUTO_SEED is set but this is a hosted Neon database (possibly production). Unset ALPHASEEKERS_AUTO_SEED, or point DATABASE_URL at a local database.`,
    );
    seeded = true;
    return;
  }

  const hasSentinel = await prisma.user.findUnique({
    where: { email: SEED_SENTINEL_EMAIL },
    select: { id: true },
  });

  if (hasSentinel) {
    await ensureApprovalDefaults();
    seeded = true;
    return;
  }

  await ensureBaseUsers();
  await ensureBaseClasses();
  await ensureBaseAvailability();
  await ensureBaseEnrollmentsAndSessions();
  await ensureSecondaryData();

  seeded = true;
}

export async function listClasses(params: ClassListParams = {}) {
  await ensureSeededData();

  const page = Math.max(1, params.page ?? 1);
  const limit = clampLimit(params.limit);
  const search = normalizeSearch(params.search);

  // Unpublished classes are kept off every student-facing list (and refused by
  // enrollStudentInClass). Staff see them through listAdminClasses instead.
  const where = {
    status: ClassStatus.ACTIVE,
    published: true,
    ...(search
      ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { subjectCategory: { contains: search, mode: "insensitive" as const } },
          { language: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {}),
  };

  const totalItems = await prisma.class.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);

  const classes = await prisma.class.findMany({
    where,
    include: {
      teacher: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    skip: (safePage - 1) * limit,
    take: limit,
    orderBy: {
      createdAt: "asc",
    },
  });

  const classIds = classes.map((item) => item.id);

  const enrollmentCounts = classIds.length
    ? await prisma.enrollment.groupBy({
      by: ["classId"],
      where: {
        classId: { in: classIds },
        status: EnrollmentStatus.ACTIVE,
      },
      _count: { _all: true },
    })
    : [];

  const countMap = new Map(enrollmentCounts.map((item) => [item.classId, item._count._all]));

  const upcomingSessions = classIds.length
    ? await prisma.session.findMany({
      where: {
        classId: { in: classIds },
        startTime: { gte: new Date() },
        cancelled: false,
      },
      // Only what the card shows. The Meet link is deliberately NOT selected:
      // this list is served to every signed-in account, and sign-up is instant.
      select: { classId: true, startTime: true },
      orderBy: {
        startTime: "asc",
      },
    })
    : [];

  const nextSessionMap = new Map<string, (typeof upcomingSessions)[number]>();

  upcomingSessions.forEach((session) => {
    if (!nextSessionMap.has(session.classId)) {
      nextSessionMap.set(session.classId, session);
    }
  });

  return {
    items: classes.map((item) => {
      const nextSession = nextSessionMap.get(item.id);

      return {
        id: item.id,
        name: item.name,
        subjectCategory: item.subjectCategory,
        description: item.description,
        teacherId: item.teacherId,
        teacherName: item.teacher.name,
        schedule: item.schedulePreference ?? "TBD",
        language: item.language,
        maxStudents: item.maxStudents,
        durationMinutes: normalizeDurationMinutes(item.durationMinutes),
        enrolledCount: countMap.get(item.id) ?? 0,
        registrationDeadline: item.registrationDeadline?.toISOString() ?? null,
        nextSessionStart: nextSession?.startTime.toISOString() ?? null,
        // No meetLink here, on purpose. It used to be the next session's link
        // for EVERY class, served to anyone signed in — i.e. to any stranger
        // after a ten-second sign-up. The class page hands the link only to
        // enrolled students and staff.
      };
    }),
    pagination: {
      page: safePage,
      limit,
      totalItems,
      totalPages,
    },
  };
}

// A session that started this long ago still counts as "upcoming": a class in
// progress (or just finished) must keep its Meet link on the page.
const UPCOMING_GRACE_MS = 3 * 60 * 60 * 1000;
const UPCOMING_SESSION_LIMIT = 50;

// Archived classes are hidden from students and from every public surface, but the
// admin detail page still needs to reach them -- otherwise archiving a class makes
// its Danger Zone (and with it permanent deletion) unreachable forever.
//
// Unpublished classes are likewise hidden unless the caller opts in. A caller
// that opts in (`includeUnpublished`) gets `published` back and must itself
// limit an unpublished class to staff, its teacher and already-enrolled
// students. `includeArchived` is the admin view and implies both.
//
// `sessions` are the UPCOMING ones only (from UPCOMING_GRACE_MS ago, soonest
// first) with a fixed set of fields — never the check-in code or the Google
// event ids. It used to be the 200 OLDEST sessions, so a class with more than a
// handful of past sessions showed old dates under "Upcoming sessions" and
// students lost today's Meet link. `sessionCount` is the all-time total.
export async function getClassById(
  classId: string,
  options: { includeArchived?: boolean; includeUnpublished?: boolean } = {},
) {
  await ensureSeededData();

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teacher: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!klass || (klass.status === ClassStatus.ARCHIVED && !options.includeArchived)) {
    return null;
  }

  if (!klass.published && !options.includeUnpublished && !options.includeArchived) {
    return null;
  }

  const [sessions, sessionCount, materials, enrollmentCount] = await Promise.all([
    // Bound eager loads: a long-running class accumulates hundreds of sessions and
    // materials, but the detail view renders only a handful. Cap both.
    prisma.session.findMany({
      where: { classId, startTime: { gte: new Date(Date.now() - UPCOMING_GRACE_MS) } },
      orderBy: { startTime: "asc" },
      take: UPCOMING_SESSION_LIMIT,
      select: {
        id: true,
        classId: true,
        startTime: true,
        endTime: true,
        meetLink: true,
        meetLinkStatus: true,
        cancelled: true,
        confirmedAt: true,
        createdAt: true,
      },
    }),
    prisma.session.count({ where: { classId } }),
    prisma.material.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.enrollment.count({
      where: {
        classId,
        status: EnrollmentStatus.ACTIVE,
      },
    }),
  ]);

  return {
    id: klass.id,
    name: klass.name,
    subjectCategory: klass.subjectCategory,
    description: klass.description,
    teacherId: klass.teacherId,
    maxStudents: klass.maxStudents,
    durationMinutes: normalizeDurationMinutes(klass.durationMinutes),
    schedulePreference: klass.schedulePreference ?? "TBD",
    language: klass.language,
    whatsappGroupUrl: (klass as { whatsappGroupUrl?: string | null }).whatsappGroupUrl ?? null,
    registrationDeadline:
      (klass as { registrationDeadline?: Date | null }).registrationDeadline?.toISOString() ?? null,
    status: klass.status,
    published: klass.published,
    createdAt: klass.createdAt.toISOString(),
    updatedAt: klass.updatedAt.toISOString(),
    teacherName: klass.teacher.name,
    enrolledCount: enrollmentCount,
    sessionCount,
    sessions: sessions.map((session) => ({
      ...session,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      confirmedAt: session.confirmedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
    })),
    materials: materials.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

// Announcements are persisted in the ClassAnnouncement table so they survive
// restarts (they were previously a module-level in-memory array — every deploy or
// cold start silently dropped every announcement).
export async function listClassAnnouncements(classId: string) {
  const rows = await prisma.classAnnouncement.findMany({
    where: { classId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    classId: row.classId,
    authorId: row.authorId,
    authorName: row.authorName,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createClassAnnouncement(input: { classId: string; authorId: string; authorName: string; content: string }) {
  const row = await prisma.classAnnouncement.create({
    data: {
      classId: input.classId,
      authorId: input.authorId,
      authorName: input.authorName,
      content: input.content,
    },
  });

  return {
    id: row.id,
    classId: row.classId,
    authorId: row.authorId,
    authorName: row.authorName,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listClassEnrollments(classId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: EnrollmentStatus.ACTIVE },
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { enrolledAt: "asc" },
  });
  return enrollments.map((e) => ({
    studentId: e.student.id,
    name: e.student.name,
    email: e.student.email,
    enrolledAt: e.enrolledAt.toISOString(),
    // Sign-up answers (ADR-0009). Callers are staff pages and the class's own
    // teacher only; never returned to students.
    answers: openAnswers(e.answers),
  }));
}

export async function listUsersByRole(role: Role) {
  await ensureSeededData();

  const users = await prisma.user.findMany({
    where: { role },
    select: {
      id: true,
      name: true,
      role: true,
      email: true,
      approvedAt: true,
    },
    orderBy: { name: "asc" },
  });

  return users;
}

/**
 * Count users of a role without loading rows. Use this for dashboard tiles /
 * headline numbers instead of `listUsersByRole(role).length`, which would drag
 * the entire (up to 10k-row) student table over the wire just to count it.
 */
export async function countUsersByRole(role: Role) {
  await ensureSeededData();

  return prisma.user.count({ where: { role } });
}

type AdminUserStatusFilter = "PENDING" | "APPROVED" | "ALL";

type AdminUserListParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role | "ALL";
  status?: AdminUserStatusFilter;
};

export async function listAdminUsers(params: AdminUserListParams = {}) {
  await ensureSeededData();

  const page = Math.max(1, params.page ?? 1);
  const limit = clampLimit(params.limit);
  const search = normalizeSearch(params.search);
  const roleFilter = params.role ?? "ALL";
  const status = params.status ?? "PENDING";

  const where = {
    ...(roleFilter !== "ALL" ? { role: roleFilter } : {}),
    ...(status === "PENDING"
      ? { approvedAt: null }
      : status === "APPROVED"
        ? { approvedAt: { not: null } }
        : {}),
    ...(search
      ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {}),
  };

  const totalItems = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      // What they asked to be at signup. Registration always creates a STUDENT,
      // so this is what tells an admin "this person applied as a teacher".
      requestedRole: true,
      approvedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * limit,
    take: limit,
  });

  return {
    items: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      approvedAt: user.approvedAt ? user.approvedAt.toISOString() : null,
    })),
    pagination: {
      page: safePage,
      limit,
      totalItems,
      totalPages,
    },
  };
}

export async function setUserApproval(userId: string, approved: boolean) {
  await ensureSeededData();

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        approvedAt: approved ? new Date() : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        approvedAt: true,
        createdAt: true,
      },
    });

    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      approvedAt: user.approvedAt ? user.approvedAt.toISOString() : null,
    };
  } catch {
    return null;
  }
}

/**
 * Change a user's coarse auth role (STUDENT/TEACHER/ADMIN).
 *
 * This exists because signup writes whatever role the applicant picked, and the
 * register form defaults to STUDENT — so anyone who submits without switching
 * the toggle lands as a STUDENT and is then invisible to `listUsersByRole
 * ("TEACHER")`, i.e. missing from the Create Class lecturer dropdown. Before
 * this, an admin had no way to correct that: the only user mutation was
 * approve/unapprove.
 *
 * Deliberately does NOT touch accessLevel/permissions — promoting someone to
 * ADMIN here yields a legacy unrestricted admin only if the super console has
 * not scoped them. Staff scoping stays the super console's job (ADR-0002).
 *
 * `allowChangingAdmin` is an argument for the same reason it is on
 * deleteUserAccount: the target's role is only known after reading the row.
 * Without it any holder of users.edit could set a SUPER_ADMIN's role to STUDENT
 * — which strips super powers (isSuper requires role=ADMIN) and walks straight
 * around super-store's "cannot demote the last super admin" guard.
 */
export async function setUserRole(
  userId: string,
  role: Role,
  options: { allowChangingAdmin?: boolean } = {},
) {
  await ensureSeededData();

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!existing) {
    return { status: "NOT_FOUND" as const };
  }

  if (existing.role === "ADMIN" && !options.allowChangingAdmin) {
    return { status: "FORBIDDEN_ADMIN" as const };
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        requestedRole: true,
        approvedAt: true,
        createdAt: true,
      },
    });

    return {
      status: "OK" as const,
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        approvedAt: user.approvedAt ? user.approvedAt.toISOString() : null,
      },
    };
  } catch {
    return { status: "NOT_FOUND" as const };
  }
}

/**
 * Why a user cannot be hard-deleted yet, if anything.
 *
 * Most User relations cascade (enrollments, attendance, availability, posts,
 * notifications, AI interactions, learning paths, Google/telegram links). TWO
 * do not, because they carry content other people depend on:
 *   - Class.teacher     (schema.prisma:143) — no onDelete ⇒ restrict
 *   - Material.uploader (schema.prisma:248) — no onDelete ⇒ restrict
 * Both FK columns are NOT NULL, so there is nothing to null out. Rather than
 * let Postgres raise an opaque FK violation (or silently destroy a class and
 * its students' history), we surface the blockers and let the admin decide.
 */
export async function getUserDeletionBlockers(userId: string) {
  const [teachingClasses, uploadedMaterials] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    }),
    prisma.material.count({ where: { uploadedBy: userId } }),
  ]);

  return { teachingClasses, uploadedMaterials };
}

/**
 * Permanently delete a user. Irreversible.
 *
 * Refuses (returns a `blocked` result) when the account still owns classes or
 * uploaded materials — see getUserDeletionBlockers. Callers must treat
 * `blocked` as a 409, not a failure to retry.
 *
 * `allowDeletingAdmin` is taken as an argument rather than checked by the
 * caller afterwards: the target's role is only known once we have read the row,
 * and deciding after the delete would be too late to stop it.
 */
export async function deleteUserAccount(
  userId: string,
  options: { allowDeletingAdmin?: boolean } = {},
) {
  await ensureSeededData();

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!existing) {
    return { status: "NOT_FOUND" as const };
  }

  if (existing.role === "ADMIN" && !options.allowDeletingAdmin) {
    return { status: "FORBIDDEN_ADMIN" as const, user: existing };
  }

  const blockers = await getUserDeletionBlockers(userId);

  if (blockers.teachingClasses.length > 0 || blockers.uploadedMaterials > 0) {
    return { status: "BLOCKED" as const, user: existing, blockers };
  }

  // These tables hold a user id in a plain column with NO foreign key, so the
  // cascade below never reaches them and they were left orphaned — and a deleted
  // user's likes kept inflating likeCount. Clear them in the same transaction as
  // the delete so a partial failure leaves nothing half-removed. Tickets and
  // ticket comments are NOT deleted: their FKs are SET NULL so the reports survive.
  await prisma.$transaction(async (tx) => {
    const likes = await tx.postLike.findMany({ where: { userId }, select: { postId: true } });
    if (likes.length > 0) {
      // One like per (post, user), so each liked post loses exactly one.
      await tx.studentPost.updateMany({
        where: { id: { in: likes.map((like) => like.postId) }, likeCount: { gt: 0 } },
        data: { likeCount: { decrement: 1 } },
      });
      await tx.postLike.deleteMany({ where: { userId } });
    }
    await tx.sessionNote.deleteMany({ where: { studentId: userId } });
    await tx.homeworkSubmission.deleteMany({ where: { studentId: userId } });
    await tx.spacedRepetitionItem.deleteMany({ where: { userId } });
    await tx.aIConversation.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  return { status: "DELETED" as const, user: existing };
}

/**
 * Aggregate class counts for the admin control panel stat cards.
 *
 * These MUST be real table-wide counts, not derived from a paginated page of
 * results (a `limit: 10` page would report at most 10 total). Mirrors the
 * aggregate approach used by getSuperKpis so the two surfaces agree.
 */
export async function getAdminClassStats() {
  const [total, active, archived] = await Promise.all([
    prisma.class.count(),
    prisma.class.count({ where: { status: ClassStatus.ACTIVE } }),
    prisma.class.count({ where: { status: ClassStatus.ARCHIVED } }),
  ]);
  return { total, active, archived };
}

export async function listAdminClasses(params: ClassListParams & { status?: ClassStatus } = {}) {
  await ensureSeededData();

  const page = Math.max(1, params.page ?? 1);
  const limit = clampLimit(params.limit);
  const search = normalizeSearch(params.search);

  const where = {
    // Optional Active/Archived filter for the admin class list.
    ...(params.status ? { status: params.status } : {}),
    ...(search
      ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { subjectCategory: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {}),
  };

  const totalItems = await prisma.class.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);

  const classes = await prisma.class.findMany({
    where,
    include: {
      teacher: {
        select: { name: true },
      },
    },
    skip: (safePage - 1) * limit,
    take: limit,
    orderBy: {
      createdAt: "desc",
    },
  });

  const counts = await prisma.enrollment.groupBy({
    by: ["classId"],
    where: {
      classId: { in: classes.map((item) => item.id) },
      status: EnrollmentStatus.ACTIVE,
    },
    _count: {
      _all: true,
    },
  });

  const countMap = new Map(counts.map((item) => [item.classId, item._count._all]));

  return {
    items: classes.map((item) => ({
      ...item,
      schedulePreference: item.schedulePreference ?? "TBD",
      teacherName: item.teacher.name,
      enrolledCount: countMap.get(item.id) ?? 0,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    pagination: {
      page: safePage,
      limit,
      totalItems,
      totalPages,
    },
  };
}

export async function createClass(input: CreateClassInput) {
  await ensureSeededData();

  const klass = await prisma.class.create({
    data: {
      name: input.name,
      subjectCategory: input.subjectCategory,
      description: input.description,
      teacherId: input.teacherId,
      maxStudents: input.maxStudents,
      durationMinutes: normalizeDurationMinutes(input.durationMinutes),
      schedulePreference: input.schedulePreference,
      language: input.language,
      status: ClassStatus.ACTIVE,
      schedulingMode: input.schedulingMode ?? "AUTO",
      // These columns require prisma db push; cast to bypass generated types
      ...(input.registrationFormUrl ? { registrationFormUrl: input.registrationFormUrl } : {}),
      ...(input.whatsappGroupUrl ? { whatsappGroupUrl: input.whatsappGroupUrl } : {}),
      ...(input.registrationDeadline ? { registrationDeadline: input.registrationDeadline } : {}),
      ...(input.joinQuestions?.length ? { joinQuestions: joinQuestionsColumn(input.joinQuestions) } : {}),
      ...(({ published: true }) as Record<string, unknown>),
    } as Parameters<typeof prisma.class.create>[0]["data"],
  });

  // Tell the teacher what they have to do, or the class silently never runs: the
  // scheduler skips any class whose teacher has not set availability, so without
  // this message nobody knows the class is waiting on them.
  //
  // A failed notification must never fail class creation -- the class row is the
  // thing that matters, and the message can be resent.
  try {
    await notifyTeacherOfNewClass({
      classId: klass.id,
      className: klass.name,
      teacherId: klass.teacherId,
      schedulePreference: input.schedulePreference ?? null,
      // MANUAL classes get "set your session dates" instead of "sessions are
      // created automatically", which is false for them.
      schedulingMode: input.schedulingMode ?? "AUTO",
    });
  } catch (error) {
    console.error("[classes] failed to notify teacher of new class", klass.id, error);
  }

  return klass;
}

export async function createClassWithSession(input: CreateClassInput) {
  await ensureSeededData();

  const schedulingMode = input.schedulingMode ?? "AUTO";

  // 1. Create the class record
  const klass = await prisma.class.create({
    data: {
      name: input.name,
      subjectCategory: input.subjectCategory,
      description: input.description,
      teacherId: input.teacherId,
      maxStudents: input.maxStudents,
      durationMinutes: normalizeDurationMinutes(input.durationMinutes),
      schedulePreference: input.schedulePreference,
      language: input.language,
      status: ClassStatus.ACTIVE,
      schedulingMode,
      // These columns require prisma db push; cast to bypass generated types
      ...(input.registrationFormUrl ? { registrationFormUrl: input.registrationFormUrl } : {}),
      ...(input.whatsappGroupUrl ? { whatsappGroupUrl: input.whatsappGroupUrl } : {}),
      ...(input.registrationDeadline ? { registrationDeadline: input.registrationDeadline } : {}),
      ...(input.joinQuestions?.length ? { joinQuestions: joinQuestionsColumn(input.joinQuestions) } : {}),
      ...(({ published: true }) as Record<string, unknown>),
    } as Parameters<typeof prisma.class.create>[0]["data"],
  });

  // MANUAL scheduling: the instructor sets the exact session times themselves, so
  // we do NOT auto-generate the initial session or Meet link here. We still notify
  // the assigned teacher, but the message asks them to set their class times.
  if (schedulingMode === "MANUAL") {
    try {
      const teacher = await prisma.user.findUnique({
        where: { id: input.teacherId },
        select: { id: true, email: true, phone: true, language: true, telegramChatId: true, pushSubscription: true, notificationPrefs: true },
      });

      if (teacher) {
        const teacherContent =
          `New class "${klass.name}" has been assigned to you.\n` +
          `This class uses manual scheduling. Please set your class session times at /teacher/classes/${klass.id}/schedule.`;

        const teacherDeliveries = await deliverWithFallback(
          { userId: teacher.id, email: teacher.email, phone: teacher.phone, telegramChatId: teacher.telegramChatId, pushSubscription: teacher.pushSubscription },
          teacherContent,
        );

        if (teacherDeliveries.length > 0) {
          await prisma.notification.createMany({
            data: teacherDeliveries.map((delivery) => ({
              userId: teacher.id,
              dedupeKey: `class_assigned:${klass.id}:${teacher.id}`,
              channel: delivery.channel,
              content: teacherContent,
              status: delivery.status,
              sentAt: new Date(),
            })),
            skipDuplicates: true,
          });
        }
      }
    } catch (err) {
      console.error("Failed to notify teacher about new manual class:", err);
    }

    return {
      class: {
        ...klass,
        createdAt: klass.createdAt.toISOString(),
        updatedAt: klass.updatedAt.toISOString(),
      },
      sessions: [],
      scheduleIssue: null,
      registrationFormUrl: (klass as Record<string, unknown>).registrationFormUrl ?? null,
      whatsappGroupUrl: (klass as Record<string, unknown>).whatsappGroupUrl ?? null,
      registrationDeadline:
        (klass as { registrationDeadline?: Date | null }).registrationDeadline?.toISOString() ?? null,
    };
  }

  // 2-4. Book the first session with exactly the rule the scheduler uses
  // (src/lib/scheduling/weekly-slot.ts): the day and time chosen in the form, only
  // if it lies inside the teacher's availability and overlaps nothing. This used
  // to take the teacher's FIRST availability slot (ignoring the chosen time) or,
  // with no availability, guess from the free text -- and then shift the class an
  // hour at a time and book an overlap anyway. No fit = no session yet; the
  // reason is returned so the success screen can say what to fix, and the
  // scheduler (daily run, availability saves) books it as soon as it fits.
  const booking = await bookNextAutoOccurrence(klass);
  const createdSessions = booking.sessions.map((session) => ({
    ...session,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
    createdAt: session.createdAt.toISOString(),
  }));

  // 5. Notify the teacher about the new class assignment
  try {
    const teacher = await prisma.user.findUnique({
      where: { id: input.teacherId },
      select: { id: true, email: true, phone: true, language: true, telegramChatId: true, pushSubscription: true, notificationPrefs: true },
    });

    if (teacher) {
      const firstSession = createdSessions[0];
      const meetInfo = firstSession?.meetLink ?? (teacher.language === "FA" ? "لینک در حال آماده‌سازی است" : "Meet link pending");
      const teacherContent = teacher.language === "FA"
        ? `صنف جدید "${klass.name}" برای شما ایجاد شده است.\nبرنامه: ${input.schedulePreference}\nلینک: ${meetInfo}\nلطفاً ساعات در دسترس بودن خود را در /teacher/availability تنظیم کنید.`
        : `New class "${klass.name}" has been assigned to you.\nSchedule: ${input.schedulePreference}\nMeet link: ${meetInfo}\nPlease set your availability at /teacher/availability.`;

      const teacherDeliveries = await deliverWithFallback(
        { userId: teacher.id, email: teacher.email, phone: teacher.phone, telegramChatId: teacher.telegramChatId, pushSubscription: teacher.pushSubscription },
        teacherContent,
      );

      if (teacherDeliveries.length > 0) {
        await prisma.notification.createMany({
          data: teacherDeliveries.map((delivery) => ({
            userId: teacher.id,
            dedupeKey: `class_assigned:${klass.id}:${teacher.id}`,
            channel: delivery.channel,
            content: teacherContent,
            status: delivery.status,
            sentAt: new Date(),
          })),
          skipDuplicates: true,
        });
      }
    }
  } catch (err) {
    console.error("Failed to notify teacher about new class:", err);
  }

  return {
    class: {
      ...klass,
      createdAt: klass.createdAt.toISOString(),
      updatedAt: klass.updatedAt.toISOString(),
    },
    sessions: createdSessions,
    scheduleIssue: booking.status === "booked" ? null : booking.reason,
    registrationFormUrl: (klass as Record<string, unknown>).registrationFormUrl ?? null,
    whatsappGroupUrl: (klass as Record<string, unknown>).whatsappGroupUrl ?? null,
    registrationDeadline:
      (klass as { registrationDeadline?: Date | null }).registrationDeadline?.toISOString() ?? null,
  };
}

export async function updateClass(classId: string, input: UpdateClassInput) {
  await ensureSeededData();

  const existing = await prisma.class.findUnique({ where: { id: classId } });

  if (!existing) {
    return null;
  }

  const { joinQuestions, ...fields } = input;
  return prisma.class.update({
    where: { id: classId },
    data: {
      ...fields,
      ...(joinQuestions !== undefined ? { joinQuestions: joinQuestionsColumn(joinQuestions) } : {}),
      ...(input.durationMinutes !== undefined
        ? {
          durationMinutes: normalizeDurationMinutes(input.durationMinutes),
        }
        : {}),
    },
  });
}

/**
 * Archive = the class STOPS. Previously this only flipped the status, so the
 * already-booked sessions kept their reminders, their Meet links and their place
 * in students' schedules. The status flip and the cancellation of every future
 * session happen in one transaction; the backing Google Calendar events are then
 * deleted best-effort (a Google failure must never undo the archive).
 */
export async function archiveClass(classId: string) {
  await ensureSeededData();

  const existing = await prisma.class.findUnique({ where: { id: classId } });

  if (!existing) {
    return null;
  }

  const now = new Date();
  const { archived, cancelledSessions } = await prisma.$transaction(async (tx) => {
    const future = await tx.session.findMany({
      where: { classId, cancelled: false, startTime: { gte: now } },
      select: { id: true, googleEventId: true, googleCalendarId: true },
    });
    if (future.length > 0) {
      await tx.session.updateMany({
        where: { id: { in: future.map((session) => session.id) } },
        data: { cancelled: true },
      });
    }
    const updated = await tx.class.update({
      where: { id: classId },
      data: { status: ClassStatus.ARCHIVED },
    });
    return { archived: updated, cancelledSessions: future };
  });

  for (const session of cancelledSessions) {
    if (!session.googleEventId) continue;
    try {
      await cancelMeetEvent({
        eventId: session.googleEventId,
        calendarId: session.googleCalendarId ?? undefined,
        teacherId: existing.teacherId,
      });
    } catch (error) {
      console.error("[classes] archive: calendar event delete failed", session.id, error);
    }
  }

  return archived;
}

/**
 * Undo an archive: the class is visible and schedulable again. Sessions that the
 * archive cancelled stay cancelled (their Meet links were deleted); an AUTO class
 * is booked again by the scheduler from its next free weekly slot, and a
 * MANUAL class's teacher adds new dates on the schedule page.
 */
export async function restoreClass(classId: string) {
  await ensureSeededData();

  const existing = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
  if (!existing) {
    return null;
  }

  return prisma.class.update({
    where: { id: classId },
    data: { status: ClassStatus.ACTIVE },
  });
}

/**
 * PERMANENTLY delete a class and everything under it. Irreversible.
 *
 * Sessions, enrollments, materials and announcements are removed by the
 * `onDelete: Cascade` FKs on the schema; DocumentChunk's class link is nullable
 * (SetNull) so we clear those RAG rows explicitly to avoid orphaned vectors.
 * Wrapped in a transaction so a partial failure leaves nothing half-deleted.
 */
export async function deleteClassPermanently(classId: string) {
  await ensureSeededData();

  const existing = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
  if (!existing) {
    return null;
  }

  await prisma.$transaction([
    prisma.documentChunk.deleteMany({ where: { classId } }),
    prisma.class.delete({ where: { id: classId } }),
  ]);

  return { id: classId };
}

/** A required sign-up question was left empty, or an answer is not valid (ADR-0009). */
export class InvalidAnswersError extends Error {
  constructor(readonly questionId: string) {
    super("Invalid answers");
  }
}

/** An enrolment row minus its stored sign-up answers, for responses sent to the browser. */
function withoutAnswers<T extends { answers: unknown }>(row: T): Omit<T, "answers"> {
  const copy = { ...row };
  delete (copy as { answers?: unknown }).answers;
  return copy;
}

export async function enrollStudentInClass(studentId: string, classId: string, rawAnswers?: unknown) {
  await ensureSeededData();

  const student = await prisma.user.findUnique({ where: { id: studentId } });

  if (!student || student.role !== "STUDENT") {
    throw new Error("Student not found");
  }

  const klass = await prisma.class.findUnique({ where: { id: classId } });

  // Only students reach this (checked above), so an unpublished class is
  // treated as absent — exactly as the public join form and the class list do.
  if (!klass || klass.status !== ClassStatus.ACTIVE || !klass.published) {
    throw new Error("Class not found");
  }

  // The class's own sign-up questions apply here exactly as on the public join
  // page; otherwise a signed-in student could skip them with one click.
  const answerCheck = checkAnswers(readJoinQuestions(klass.joinQuestions), rawAnswers);
  if (!answerCheck.ok) {
    throw new InvalidAnswersError(answerCheck.questionId);
  }
  const answers = sealAnswers(answerCheck.answers);

  // Capacity guard MUST be atomic. The old check-then-insert (count, compare,
  // insert) races under concurrency: N simultaneous requests each read
  // activeCount < maxStudents and all insert, oversubscribing the class. We take
  // a per-class transaction advisory lock so the count-then-insert is serialized
  // for THIS class; the lock is released on commit (safe under PgBouncer
  // transaction pooling, unlike a session-level lock).
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`enroll:${classId}`}))`;

    const current = await tx.enrollment.findUnique({
      where: { studentId_classId: { studentId, classId } },
    });

    if (current?.status === EnrollmentStatus.ACTIVE) {
      return { enrollment: current, state: "ALREADY_ENROLLED" as const, activeCount: 0 };
    }

    // A PENDING row is a student who asked under the old model and was never
    // approved. Since nothing creates pending rows any more, nobody is watching
    // that queue — telling her "you have already asked, keep waiting" would
    // strand her permanently. So she falls through and is admitted now, subject
    // to the same capacity and deadline checks as anyone else. This is what
    // un-sticks the students who have been waiting since before this change.
    //
    // REJECTED is different and is still honoured below: that was a deliberate
    // human decision to remove someone, and clicking again must not undo it.

    // A previous rejection is not something a student can undo by clicking
    // again; an admin has to change it.
    if (current?.status === EnrollmentStatus.REJECTED) {
      throw new Error("Enrollment rejected");
    }

    // Re-read capacity inside the transaction so a concurrent maxStudents change
    // (or archival) is honored.
    const klassInTx = await tx.class.findUnique({
      where: { id: classId },
      select: { maxStudents: true, status: true, registrationDeadline: true },
    });

    if (!klassInTx || klassInTx.status !== ClassStatus.ACTIVE) {
      throw new Error("Class not found");
    }

    // Registration cutoff. Checked inside the transaction alongside capacity so a
    // deadline edited mid-request is honoured, and so the UI hiding the button is
    // never the only thing standing between a late request and the database.
    // A null deadline means open indefinitely — the behaviour of every class that
    // predates this field. Students already enrolled are unaffected: this guards
    // the request path only.
    if (klassInTx.registrationDeadline && klassInTx.registrationDeadline.getTime() < Date.now()) {
      throw new Error("Registration closed");
    }

    const activeCount = await tx.enrollment.count({
      where: { classId, status: EnrollmentStatus.ACTIVE },
    });

    if (activeCount >= klassInTx.maxStudents) {
      throw new Error("Class is full");
    }

    // Joining is IMMEDIATE. It used to create a PENDING request an admin had to
    // approve, which put a human — usually a volunteer who is also a student —
    // between a learner and the class they had already found, signed up for and
    // been accepted into by capacity. People waited days, or forever. The class
    // page's own controls (capacity, the registration deadline, publishing) are
    // the gate now, and a teacher can remove anyone who should not be there.
    //
    // NOTE: this stops CREATING pending rows. It deliberately does not touch
    // rows that already exist — there are real students sitting in PENDING in
    // production, and the admin approval screen stays working so they can still
    // be let in rather than being stranded by this change.
    const enrollment = current
      ? await tx.enrollment.update({
        where: { studentId_classId: { studentId, classId } },
        data: { status: EnrollmentStatus.ACTIVE, enrolledAt: new Date(), ...(answers ? { answers } : {}) },
      })
      : await tx.enrollment.create({
        data: { studentId, classId, status: EnrollmentStatus.ACTIVE, ...(answers ? { answers } : {}) },
      });

    return { enrollment, state: "JOINED" as const, activeCount };
  });

  // The stored answers (phone encrypted) stay out of the response.
  if (result.state === "ALREADY_ENROLLED") {
    const current = withoutAnswers(result.enrollment);
    return {
      enrollment: {
        ...current,
        enrolledAt: current.enrolledAt.toISOString(),
      },
      state: result.state,
    };
  }

  const enrollment = withoutAnswers(result.enrollment);

  // The enrollment is committed. Enrollment notifications (the student welcome and
  // the teacher "new student enrolled" message) are NOT sent here anymore: the
  // enroll route emits `student.enrolled` on the durable event bus, which fans out
  // to the `welcome_student` and `welcome_teacher` job handlers. This keeps a single
  // notification path off the request thread and out of db-store.

  return {
    enrollment: {
      ...enrollment,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    },
    state: "JOINED" as const,
    // Deliveries are dispatched asynchronously after commit, so there are no
    // synchronously-known results; the key is retained for response-shape stability.
    deliveries: [] as NotificationDelivery[],
  };
}

/**
 * Take a student out of a class. Only an ACTIVE or PENDING enrolment is ever
 * changed; anything else returns null ("not in this class").
 *
 *  - by "self": the student leaving. DROPPED — reversible, they may join again.
 *  - by "staff": the teacher (or an admin) removing them. REJECTED — the one
 *    status both the in-app enroll and the public join refuse. This used to be
 *    DROPPED too, so a removed student could rejoin with one click, and a
 *    REJECTED student could "leave" (turning REJECTED into DROPPED) and rejoin.
 *
 * No enum change: REJECTED already means "a person decided you are out".
 */
export async function dropStudentFromClass(
  studentId: string,
  classId: string,
  options: { by: "self" | "staff" } = { by: "self" },
) {
  await ensureSeededData();

  const { count } = await prisma.enrollment.updateMany({
    where: {
      studentId,
      classId,
      status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.PENDING] },
    },
    data: {
      status: options.by === "staff" ? EnrollmentStatus.REJECTED : EnrollmentStatus.DROPPED,
    },
  });

  if (count === 0) {
    return null;
  }

  return prisma.enrollment.findUnique({
    where: {
      studentId_classId: {
        studentId,
        classId,
      },
    },
  });
}

export async function isStudentEnrolledInClass(studentId: string, classId: string) {
  await ensureSeededData();

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_classId: {
        studentId,
        classId,
      },
    },
    select: { status: true },
  });

  return enrollment?.status === EnrollmentStatus.ACTIVE;
}

export async function listStudentClasses(studentId: string) {
  await ensureSeededData();

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: EnrollmentStatus.ACTIVE,
      class: {
        status: ClassStatus.ACTIVE,
      },
    },
    include: {
      class: {
        include: {
          teacher: {
            select: { name: true },
          },
        },
      },
    },
  });

  const classIds = enrollments.map((item) => item.classId);

  const upcoming = classIds.length
    ? await prisma.session.findMany({
      where: {
        classId: { in: classIds },
        startTime: { gte: new Date() },
        cancelled: false,
      },
      orderBy: {
        startTime: "asc",
      },
    })
    : [];

  const nextSessionMap = new Map<string, (typeof upcoming)[number]>();

  upcoming.forEach((session) => {
    if (!nextSessionMap.has(session.classId)) {
      nextSessionMap.set(session.classId, session);
    }
  });

  return enrollments.map((entry) => ({
    id: entry.class.id,
    name: entry.class.name,
    teacherName: entry.class.teacher.name,
    schedule: entry.class.schedulePreference ?? "TBD",
    language: entry.class.language,
    durationMinutes: normalizeDurationMinutes(entry.class.durationMinutes),
    nextSession: nextSessionMap.get(entry.class.id)
      ? {
        ...nextSessionMap.get(entry.class.id)!,
        startTime: nextSessionMap.get(entry.class.id)!.startTime.toISOString(),
        endTime: nextSessionMap.get(entry.class.id)!.endTime.toISOString(),
        createdAt: nextSessionMap.get(entry.class.id)!.createdAt.toISOString(),
      }
      : null,
  }));
}

export async function getStudentProfileSummary(studentId: string) {
  await ensureSeededData();

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      timezone: true,
      language: true,
      createdAt: true,
    },
  });

  if (!student || student.role !== "STUDENT") {
    return null;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: EnrollmentStatus.ACTIVE,
      class: {
        status: ClassStatus.ACTIVE,
      },
    },
    include: {
      class: {
        include: {
          teacher: {
            select: { name: true },
          },
        },
      },
    },
  });

  const classIds = enrollments.map((item) => item.classId);
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  // Window the profile's session scan: recent history feeds progress %, the next
  // ~3 months feed the upcoming list. Bounding this prevents scanning every session
  // ever created for the student's classes. Progress for classes older than the
  // lookback reflects sessions within the window.
  const profileWindowStart = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
  const profileWindowEnd = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  const sessions = classIds.length
    ? await prisma.session.findMany({
      where: {
        classId: { in: classIds },
        cancelled: false,
        startTime: { gte: profileWindowStart, lte: profileWindowEnd },
      },
      include: {
        class: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
      take: 500,
    })
    : [];

  const materialCounts = classIds.length
    ? await prisma.material.groupBy({
      by: ["classId"],
      where: {
        classId: { in: classIds },
      },
      _count: {
        _all: true,
      },
    })
    : [];

  const [notifications, opportunities] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: studentId,
      },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.opportunity.findMany({
      where: {
        deadline: { gte: now },
      },
      orderBy: {
        deadline: "asc",
      },
      take: 4,
    }),
  ]);

  const materialCountMap = new Map(materialCounts.map((item) => [item.classId, item._count._all]));
  const sessionsByClass = new Map<string, (typeof sessions)[number][]>();

  sessions.forEach((session) => {
    const existing = sessionsByClass.get(session.classId);

    if (existing) {
      existing.push(session);
      return;
    }

    sessionsByClass.set(session.classId, [session]);
  });

  const upcoming = sessions
    .filter((session) => session.startTime >= now)
    .slice(0, 10)
    .map((session) => ({
      id: session.id,
      classId: session.classId,
      className: session.class.name,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      meetLink: session.meetLink,
      meetLinkStatus: session.meetLinkStatus,
    }));

  const classes = enrollments
    .map((entry) => {
      const classSessions = sessionsByClass.get(entry.classId) ?? [];
      const completedSessions = classSessions.filter((session) => session.startTime < now).length;
      const upcomingSessions = classSessions.filter((session) => session.startTime >= now).length;
      const totalSessions = classSessions.length;
      const nextSession = classSessions.find((session) => session.startTime >= now) ?? null;
      const progressPercent =
        totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0;

      return {
        id: entry.class.id,
        name: entry.class.name,
        teacherName: entry.class.teacher.name,
        language: entry.class.language,
        schedule: entry.class.schedulePreference ?? "TBD",
        durationMinutes: normalizeDurationMinutes(entry.class.durationMinutes),
        materialCount: materialCountMap.get(entry.classId) ?? 0,
        completedSessions,
        upcomingSessions,
        totalSessions,
        progressPercent,
        nextSessionStart: nextSession?.startTime.toISOString() ?? null,
        nextSessionMeetLink: nextSession?.meetLink ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      timezone: student.timezone,
      language: student.language,
      createdAt: student.createdAt.toISOString(),
    },
    stats: {
      activeClasses: classes.length,
      sessionsThisWeek: upcoming.filter((session) => new Date(session.startTime) <= weekAhead).length,
      totalMaterials: Array.from(materialCountMap.values()).reduce((sum, count) => sum + count, 0),
      notifications: notifications.length,
      nextSessionStart: upcoming[0]?.startTime ?? null,
    },
    classes,
    upcoming,
    notifications: notifications.map((item) => ({
      id: item.id,
      channel: item.channel,
      status: item.status,
      content: item.content,
      sentAt: item.sentAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
    opportunities: opportunities.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      description: item.description,
      deadline: item.deadline.toISOString(),
      externalUrl: item.externalUrl,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

function findContinuationSegment(
  schedule: Array<{
    id: string;
    classId: string;
    startTime: string;
    endTime: string;
    meetLink: string | null;
  }>,
  current: {
    id: string;
    classId: string;
    startTime: string;
    endTime: string;
  },
) {
  const currentEnd = new Date(current.endTime).getTime();
  const maxGapMs = SEGMENT_TRANSITION_WINDOW_MINUTES * 60 * 1000;

  return (
    schedule.find((item) => {
      if (item.id === current.id || item.classId !== current.classId) {
        return false;
      }

      const start = new Date(item.startTime).getTime();
      return start > currentEnd && start - currentEnd <= maxGapMs;
    }) ?? null
  );
}

/**
 * Fetch a student's non-cancelled sessions within a bounded time window and attach
 * continuation segments. Windowing + take keep this from scanning every session
 * the student has ever had (which grows without bound over a class's lifetime).
 */
async function buildStudentSchedule(
  studentId: string,
  window: { from: Date; to: Date; take: number },
) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      status: EnrollmentStatus.ACTIVE,
    },
    select: {
      classId: true,
    },
  });

  const classIds = enrollments.map((item) => item.classId);

  const sessions = classIds.length
    ? await prisma.session.findMany({
      where: {
        classId: { in: classIds },
        cancelled: false,
        startTime: { gte: window.from, lte: window.to },
        // An archived class has stopped: its sessions must not appear in a
        // student's schedule or join-now prompt.
        class: { status: ClassStatus.ACTIVE },
      },
      include: {
        class: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
      take: window.take,
    })
    : [];

  const schedule = sessions.map((item) => ({
    id: item.id,
    classId: item.classId,
    className: item.class.name,
    startTime: item.startTime.toISOString(),
    endTime: item.endTime.toISOString(),
    meetLink: item.meetLink,
    meetLinkStatus: item.meetLinkStatus,
  }));

  return schedule.map((item) => {
    const continuation = findContinuationSegment(schedule, item);

    return {
      ...item,
      continuation: continuation
        ? {
          sessionId: continuation.id,
          startTime: continuation.startTime,
          meetLink: continuation.meetLink,
        }
        : null,
    };
  });
}

export async function listStudentSchedule(studentId: string) {
  await ensureSeededData();

  const now = Date.now();
  // Bound the schedule to a relevant window: a small lookback so an in-progress
  // session still appears, out to two months ahead. Cap the row count as a hard
  // safety net.
  return buildStudentSchedule(studentId, {
    from: new Date(now - 3 * 60 * 60 * 1000),
    to: new Date(now + 60 * 24 * 60 * 60 * 1000),
    take: 300,
  });
}

export async function getJoinNowSession(studentId: string) {
  await ensureSeededData();

  const now = Date.now();
  const lookback = 15 * 60 * 1000;

  // Only sessions around "now" matter for a join-now prompt — never scan the full
  // history. A short window (a few hours back to an hour ahead) covers an
  // in-progress session and its continuation segment.
  const schedule = await buildStudentSchedule(studentId, {
    from: new Date(now - 6 * 60 * 60 * 1000),
    to: new Date(now + 60 * 60 * 1000),
    take: 50,
  });

  const activeOrUpcoming =
    schedule.find((item) => {
      const start = new Date(item.startTime).getTime();
      const end = new Date(item.endTime).getTime();
      return now >= start - lookback && now <= end;
    }) ??
    schedule.find((item) => {
      const start = new Date(item.startTime).getTime();
      return start > now && start <= now + lookback;
    }) ??
    null;

  return activeOrUpcoming;
}

export async function listTeacherAvailability(teacherId: string) {
  await ensureSeededData();

  const slots = await prisma.teacherAvailability.findMany({
    where: { teacherId },
    orderBy: [{ dayOfWeek: "asc" }, { startTimeUTC: "asc" }],
  });

  return slots.map((item) => ({
    id: item.id,
    teacherId: item.teacherId,
    dayOfWeek: item.dayOfWeek,
    startMinute: utcDateToMinute(item.startTimeUTC),
    endMinute: utcDateToMinute(item.endTimeUTC),
  }));
}

export async function replaceTeacherAvailability(
  teacherId: string,
  slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>,
) {
  await ensureSeededData();

  await prisma.teacherAvailability.deleteMany({
    where: { teacherId },
  });

  const normalized = slots
    .filter((slot) => slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6)
    .filter((slot) => slot.startMinute >= 0 && slot.endMinute <= 24 * 60 && slot.endMinute > slot.startMinute)
    .map((slot) => ({
      teacherId,
      dayOfWeek: slot.dayOfWeek,
      startTimeUTC: minuteToUtcDate(slot.startMinute),
      endTimeUTC: minuteToUtcDate(slot.endMinute),
    }));

  if (normalized.length > 0) {
    await prisma.teacherAvailability.createMany({
      data: normalized,
    });
  }

  return listTeacherAvailability(teacherId);
}

export async function hasTeacherConflict(
  teacherId: string,
  startTime: Date,
  endTime: Date,
  excludeSessionId?: string,
) {
  const conflict = await prisma.session.findFirst({
    where: {
      cancelled: false,
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      startTime: {
        lt: endTime,
      },
      endTime: {
        gt: startTime,
      },
      class: {
        teacherId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(conflict);
}

// ─── Auto-scheduling (AUTO classes) ──────────────────────────────────────────
//
// One booking path shared by the scheduler, the post-availability
// scheduling and class creation, so they cannot drift apart again. The rule
// itself (posted day/time, inside availability, never an overlap) lives in
// src/lib/scheduling/weekly-slot.ts.

const DAY_MS = 24 * 60 * 60 * 1000;
// A session within this distance of the target slot belongs to the same weekly
// occurrence (half a week either side, so neighbouring weeks never collide).
const OCCURRENCE_HALF_WINDOW_MS = 3.5 * DAY_MS;

export type AutoScheduleSkipReason = SlotProblem | "already-handled" | "clash";

type AutoBookingClass = {
  id: string;
  name: string;
  teacherId: string;
  durationMinutes: number | null;
  schedulePreference: string | null;
};

type BookedSession = Awaited<ReturnType<typeof prisma.session.create>>;

type AutoBookingOutcome =
  | { status: "booked"; sessions: BookedSession[] }
  | { status: "skipped"; reason: AutoScheduleSkipReason; sessions: BookedSession[] };

function toMeetLinkStatus(status: MeetGenerationResult["status"]) {
  return status === "FAILED"
    ? MeetLinkStatus.FAILED
    : status === "PENDING"
      ? MeetLinkStatus.PENDING
      : MeetLinkStatus.GENERATED;
}

/** A teacher's availability as Kabul minutes-after-midnight windows. */
export async function loadAvailabilityWindows(teacherId: string) {
  const rows = await prisma.teacherAvailability.findMany({
    where: { teacherId },
    select: { dayOfWeek: true, startTimeUTC: true, endTimeUTC: true },
  });
  return rows.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    startMinute: utcDateToMinute(row.startTimeUTC),
    endMinute: utcDateToMinute(row.endTimeUTC),
  }));
}

/**
 * Saved hours for several teachers in one query, keyed by teacher id, in the
 * same Kabul-minute form the scheduler checks against (loadAvailabilityWindows).
 * The class form shows them, so staff can pick a time that will actually book.
 */
export async function loadAvailabilityByTeacher(teacherIds: string[]) {
  const rows = teacherIds.length
    ? await prisma.teacherAvailability.findMany({
      where: { teacherId: { in: teacherIds } },
      select: { teacherId: true, dayOfWeek: true, startTimeUTC: true, endTimeUTC: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTimeUTC: "asc" }],
    })
    : [];
  const byTeacher: Record<string, Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>> = {};
  for (const row of rows) {
    (byTeacher[row.teacherId] ??= []).push({
      dayOfWeek: row.dayOfWeek,
      startMinute: utcDateToMinute(row.startTimeUTC),
      endMinute: utcDateToMinute(row.endTimeUTC),
    });
  }
  return byTeacher;
}

/**
 * Has this weekly occurrence already been dealt with? Any session -- cancelled or
 * not -- near the target slot counts: a cancelled session must STAY cancelled
 * (the old check ignored cancelled rows, so a teacher's cancellation was undone
 * by the next scheduler run, at the very same time). A session the scheduler booked
 * for this cycle and the teacher then MOVED further out also counts (the old
 * 7-day window made a fresh one appear this week). "Moved" = created this cycle
 * and confirmed later than it was created; a session ADDED by hand is confirmed
 * at creation and does not stop the regular weekly class (if it sits exactly on
 * the slot, the overlap check skips the booking instead).
 */
async function isOccurrenceHandled(
  db: Pick<typeof prisma, "session">,
  classId: string,
  target: Date,
  now: Date,
) {
  const addedByHand = (session: { createdAt: Date; confirmedAt: Date | null }) =>
    session.confirmedAt !== null && Math.abs(session.confirmedAt.getTime() - session.createdAt.getTime()) <= 60_000;

  const nearSlot = await db.session.findMany({
    where: {
      classId,
      startTime: {
        gte: new Date(target.getTime() - OCCURRENCE_HALF_WINDOW_MS),
        lt: new Date(target.getTime() + OCCURRENCE_HALF_WINDOW_MS),
      },
    },
    select: { createdAt: true, confirmedAt: true },
  });
  if (nearSlot.some((session) => !addedByHand(session))) return true;

  const cycleStart = new Date(target.getTime() - 7 * DAY_MS - 60 * 60 * 1000);
  const movedOut = await db.session.findMany({
    where: { classId, cancelled: false, startTime: { gte: now }, createdAt: { gte: cycleStart } },
    select: { createdAt: true, confirmedAt: true },
  });
  return movedOut.some((session) => session.confirmedAt !== null && !addedByHand(session));
}

/** Generate (or re-generate) the Meet link for freshly booked rows, storing the event ids. */
async function attachMeetLinks(className: string, teacherId: string, rows: BookedSession[]) {
  const updated: BookedSession[] = [];
  for (const row of rows) {
    const meet = await generateMeetLink(className, row.startTime.toISOString(), {
      endIso: row.endTime.toISOString(),
      teacherId,
    });
    updated.push(
      await prisma.session.update({
        where: { id: row.id },
        data: {
          meetLink: meet.link,
          meetLinkStatus: toMeetLinkStatus(meet.status),
          // Persisted on EVERY create path so cancel can delete the event (and its
          // joinable link) and reschedule can patch it instead of minting a second.
          googleEventId: meet.eventId,
          googleCalendarId: meet.calendarId,
        },
      }),
    );
  }
  return updated;
}

/**
 * Book the next weekly occurrence of an AUTO class, or say why not.
 *
 * The "already handled?" check, the overlap check and the row inserts run in one
 * transaction under a per-teacher advisory lock, so the scheduler, the
 * post-availability scheduling and class creation can never book the same slot
 * twice or overlap each other. The slow Meet-link calls run after commit.
 */
async function bookNextAutoOccurrence(klass: AutoBookingClass): Promise<AutoBookingOutcome> {
  const now = new Date();
  const durationMinutes = normalizeDurationMinutes(klass.durationMinutes);
  const plan = planAutoSlot({
    schedulePreference: klass.schedulePreference,
    spanMinutes: classSpanMinutes(durationMinutes, FREE_MEET_SEGMENT_MINUTES, SEGMENT_BREAK_MINUTES),
    availability: await loadAvailabilityWindows(klass.teacherId),
  });

  if (!plan.ok) {
    console.log(`[scheduler] not booking class ${klass.id} (${klass.name}): ${plan.reason}`);
    return { status: "skipped", reason: plan.reason, sessions: [] };
  }

  const target = nextWeekdayDate(plan.slot.dayOfWeek, plan.slot.hour, plan.slot.minute);
  const windows = buildSegmentWindows(target, durationMinutes);

  const result = await prisma.$transaction(async (tx): Promise<
    { kind: "skipped"; reason: "already-handled" | "clash" } | { kind: "rows"; rows: BookedSession[] }
  > => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${SCHEDULER_ADVISORY_LOCK_KEY}, hashtext($1))`,
      klass.teacherId,
    );

    if (await isOccurrenceHandled(tx, klass.id, target, now)) {
      return { kind: "skipped", reason: "already-handled" };
    }

    for (const window of windows) {
      const clash = await tx.session.findFirst({
        where: {
          cancelled: false,
          startTime: { lt: window.endTime },
          endTime: { gt: window.startTime },
          class: { teacherId: klass.teacherId },
        },
        select: { id: true },
      });
      if (clash) {
        return { kind: "skipped", reason: "clash" };
      }
    }

    const rows: BookedSession[] = [];
    for (const window of windows) {
      rows.push(
        await tx.session.create({
          data: {
            classId: klass.id,
            startTime: window.startTime,
            endTime: window.endTime,
            meetLinkStatus: MeetLinkStatus.PENDING,
            cancelled: false,
          },
        }),
      );
    }
    return { kind: "rows", rows };
  });

  if (result.kind === "skipped") {
    if (result.reason === "clash") {
      console.log(`[scheduler] not booking class ${klass.id} (${klass.name}): overlaps another session of the teacher`);
    }
    return { status: "skipped", reason: result.reason, sessions: [] };
  }

  return { status: "booked", sessions: await attachMeetLinks(klass.name, klass.teacherId, result.rows) };
}

/** Full delivery target (every channel + the user's channel preferences). */
const deliveryUserSelect = {
  id: true,
  email: true,
  phone: true,
  timezone: true,
  language: true,
  telegramChatId: true,
  pushSubscription: true,
  notificationPrefs: true,
} as const;

type DeliveryUser = {
  id: string;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  language: "FA" | "EN";
  telegramChatId: string | null;
  pushSubscription: string | null;
  notificationPrefs: string | null;
};

function toDeliveryTarget(user: DeliveryUser): NotificationTarget {
  return {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    telegramChatId: user.telegramChatId,
    pushSubscription: user.pushSubscription,
    notificationPrefs: user.notificationPrefs,
  };
}

/** The ACTIVE students of a class, with everything needed to reach them. */
export async function listClassDeliveryTargets(classId: string): Promise<DeliveryUser[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: EnrollmentStatus.ACTIVE },
    select: { student: { select: deliveryUserSelect } },
  });
  return enrollments.map((enrollment) => enrollment.student);
}

/**
 * Send a per-recipient message to each user (bounded concurrency, awaited) and
 * record what happened as Notification rows, so the message is in their
 * in-app inbox and the team can see whether it reached anyone. A dedupeKey makes
 * a retried call a no-op for recipients already handled.
 */
export async function deliverAndRecord(
  recipients: DeliveryUser[],
  contentFor: (user: DeliveryUser) => string,
  dedupeKeyFor?: (user: DeliveryUser) => string,
) {
  let sent = 0;
  await mapWithConcurrency(recipients, DELIVERY_CONCURRENCY, async (user) => {
    const content = contentFor(user);
    const deliveries = await deliverWithFallback(toDeliveryTarget(user), content);
    // Count only real deliveries; the PLATFORM fallback always reports SENT.
    if (landedOnRealChannel(deliveries)) sent += 1;
    if (deliveries.length > 0) {
      await prisma.notification.createMany({
        data: deliveries.map((delivery) => ({
          userId: user.id,
          ...(dedupeKeyFor ? { dedupeKey: dedupeKeyFor(user) } : {}),
          channel: delivery.channel,
          content,
          status: delivery.status,
          sentAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }
  });
  return { recipients: recipients.length, sent };
}

/** Tell a class's students about newly booked session(s), in their own time zone. */
async function notifyStudentsOfNewSessions(klass: { id: string; name: string }, sessions: BookedSession[]) {
  if (sessions.length === 0) return;
  const first = sessions[0];
  const second = sessions[1] ?? null;
  const students = await listClassDeliveryTargets(klass.id);

  await deliverAndRecord(students, (student) => {
    const when = formatDateTimeForUser(first.startTime, student.timezone, student.language);
    if (!second) {
      return `New session scheduled: ${klass.name} on ${when}. Join: ${first.meetLink ?? "Meet link pending"}`;
    }
    const nextWhen = formatDateTimeForUser(second.startTime, student.timezone, student.language);
    return (
      `New session scheduled: ${klass.name} on ${when}. Segment 1 link: ${first.meetLink ?? "Meet link pending"}. ` +
      `After a ${SEGMENT_BREAK_MINUTES}-minute break, segment 2 starts at ${nextWhen}. ` +
      `Next link: ${second.meetLink ?? "Meet link pending"}.`
    );
  });
}

/**
 * Retry missing Meet links for sessions in the next 7 days. Without this a link
 * that was PENDING (Google not reachable) or FAILED at booking time stayed
 * missing forever -- production has mock links off. Runs inside the
 * scheduler (runSchedulerBatch: the daily cron run and on-demand runs). Each write is conditional on the row still being in the state we
 * read, so two overlapping runs cannot both attach a link; the loser deletes the
 * calendar event it just created.
 */
async function retryMissingMeetLinks(now: Date, limit = 20, onlySessionIds?: string[]) {
  const due = await prisma.session.findMany({
    where: {
      ...(onlySessionIds ? { id: { in: onlySessionIds } } : {}),
      cancelled: false,
      startTime: { gte: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
      class: { status: ClassStatus.ACTIVE },
      OR: [{ meetLink: null }, { meetLinkStatus: { in: [MeetLinkStatus.PENDING, MeetLinkStatus.FAILED] } }],
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      meetLink: true,
      meetLinkStatus: true,
      googleEventId: true,
      googleCalendarId: true,
      class: { select: { name: true, teacherId: true } },
    },
    orderBy: { startTime: "asc" },
    take: limit,
  });

  let repaired = 0;
  for (const session of due) {
    const meet = await generateMeetLink(session.class.name, session.startTime.toISOString(), {
      endIso: session.endTime.toISOString(),
      teacherId: session.class.teacherId,
    });
    if (meet.status !== "GENERATED" || !meet.link) continue;

    const { count } = await prisma.session.updateMany({
      where: {
        id: session.id,
        cancelled: false,
        meetLink: session.meetLink,
        meetLinkStatus: session.meetLinkStatus,
      },
      data: {
        meetLink: meet.link,
        meetLinkStatus: MeetLinkStatus.GENERATED,
        googleEventId: meet.eventId,
        googleCalendarId: meet.calendarId,
      },
    });

    // Lost the race (or staff set a link meanwhile): drop the event we just made.
    // Won it: drop the half-made event from the failed attempt, if any.
    const orphan =
      count === 0
        ? { eventId: meet.eventId, calendarId: meet.calendarId }
        : session.googleEventId && session.googleEventId !== meet.eventId
          ? { eventId: session.googleEventId, calendarId: session.googleCalendarId }
          : null;
    if (orphan?.eventId) {
      await cancelMeetEvent({
        eventId: orphan.eventId,
        calendarId: orphan.calendarId ?? undefined,
        teacherId: session.class.teacherId,
      }).catch(() => undefined);
    }
    if (count > 0) repaired += 1;
  }
  return repaired;
}

/**
 * Book the next session of each of a teacher's AUTO classes right after they
 * save availability, instead of waiting for the next scheduler run. Same rule and lock as
 * the scheduler (bookNextAutoOccurrence): with no availability rows nothing is
 * booked -- the old code fell back to the free-text schedule here and booked a
 * teacher who had just unticked every day.
 */
export async function scheduleTeacherClasses(teacherId: string) {
  await ensureSeededData();

  // Only AUTO classes are auto-scheduled. MANUAL classes have instructor-set
  // session times and must never receive auto-created sessions.
  const teacherClasses = await prisma.class.findMany({
    where: { teacherId, status: ClassStatus.ACTIVE, schedulingMode: "AUTO" },
  });

  let sessionsCreated = 0;

  for (const klass of teacherClasses) {
    const booking = await bookNextAutoOccurrence(klass);
    sessionsCreated += booking.sessions.length;
    await notifyStudentsOfNewSessions(klass, booking.sessions);
  }

  return { classesChecked: teacherClasses.length, sessionsCreated };
}

/**
 * Upcoming sessions of a class for the staff class page: the NEXT ones (not the
 * oldest), including upcoming cancelled ones so staff can see what was called
 * off. A short lookback keeps an in-progress session visible.
 */
export async function listUpcomingClassSessions(classId: string, take = 10) {
  const sessions = await prisma.session.findMany({
    where: { classId, endTime: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { startTime: "asc" },
    take,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      meetLink: true,
      meetLinkStatus: true,
      cancelled: true,
    },
  });
  return sessions.map((session) => ({
    ...session,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
  }));
}

/** Class fields the lifecycle pages need that getClassById does not return. */
export async function getClassLifecycleExtras(classId: string) {
  return prisma.class.findUnique({
    where: { id: classId },
    select: {
      status: true,
      schedulingMode: true,
      registrationFormUrl: true,
      registrationDeadline: true,
      teacherId: true,
      joinQuestions: true,
    },
  });
}

/**
 * Staff set a session's Meet link by hand (the fallback when Google is not
 * connected or generation failed). Marked GENERATED so the scheduler's retry leaves
 * it alone. Scoped by class id so a forged session id from another class
 * matches nothing. An empty link clears it back to PENDING for the retry.
 */
export async function setSessionMeetLink(classId: string, sessionId: string, meetLink: string | null) {
  const { count } = await prisma.session.updateMany({
    where: { id: sessionId, classId, cancelled: false },
    data: meetLink
      ? { meetLink, meetLinkStatus: MeetLinkStatus.GENERATED }
      : { meetLink: null, meetLinkStatus: MeetLinkStatus.PENDING },
  });
  return count > 0;
}

export async function runSchedulerBatch() {
  await ensureSeededData();

  const now = new Date();

  const activeClasses = await prisma.class.findMany({
    where: {
      status: ClassStatus.ACTIVE,
      // Only AUTO classes are auto-scheduled. MANUAL classes have instructor-set
      // session times and must never receive auto-created sessions.
      schedulingMode: "AUTO",
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Atomically claim a disjoint work slice. The previous code read the RUNNING job
  // and sliced [processedCount, +10) WITHOUT synchronization: two overlapping cron
  // runs both read the same processedCount, created duplicate SchedulerJobs, and
  // processed the SAME classes — producing duplicate sessions and notifications.
  // We now take a transaction advisory lock and advance processedCount inside the
  // transaction, so concurrent runs receive non-overlapping slices. Only the short
  // claim is inside the transaction; the slow session/meet/notification work runs
  // after commit.
  const claim = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${SCHEDULER_ADVISORY_LOCK_KEY})`);

    let current = await tx.schedulerJob.findFirst({
      where: { status: SchedulerJobStatus.RUNNING },
      orderBy: { createdAt: "desc" },
    });

    if (!current) {
      current = await tx.schedulerJob.create({
        data: {
          status: SchedulerJobStatus.RUNNING,
          processedCount: 0,
          totalCount: activeClasses.length,
        },
      });
    }

    // Progress is measured against the LIVE class count, never the totalCount
    // stored when the job was created. Comparing against the stored value
    // deadlocked production for 3.5 months: a job written on 2026-04-27 held
    // totalCount=12 while the class list had since shrunk to 2, so every run
    // computed slice(2, min(12, 2)) = slice(2, 2) — an empty batch — and
    // `2 >= 12` was never true, so the row never closed and no replacement job
    // was ever created. Sessions stopped being generated entirely.
    //
    // Clamping start to the live total means a shrunken list completes the job
    // instead of stranding the cursor past the end, so a stalled row heals
    // itself on the next tick rather than needing manual surgery.
    const total = activeClasses.length;
    const start = Math.min(current.processedCount, total);
    const end = Math.min(start + 10, total);
    const complete = end >= total;

    const updated = await tx.schedulerJob.update({
      where: { id: current.id },
      data: {
        processedCount: end,
        // Re-sync the stored total so diagnostics reflect reality rather than a
        // snapshot from whenever this row happened to be created.
        totalCount: total,
        status: complete ? SchedulerJobStatus.COMPLETED : SchedulerJobStatus.RUNNING,
        lastRunAt: new Date(),
      },
    });

    return { job: updated, start, end, complete };
  });

  const batch = activeClasses.slice(claim.start, claim.end);

  for (const klass of batch) {
    const booking = await bookNextAutoOccurrence(klass);
    await notifyStudentsOfNewSessions(klass, booking.sessions);
  }

  // Every run, not just once per batch cycle: links that were missing at booking
  // time (Google down, token revoked, nothing configured yet) get another try.
  const meetLinksRepaired = await retryMissingMeetLinks(now);

  const updatedJob = claim.job;

  return {
    job: {
      ...updatedJob,
      lastRunAt: updatedJob.lastRunAt?.toISOString() ?? null,
      createdAt: updatedJob.createdAt.toISOString(),
      updatedAt: updatedJob.updatedAt.toISOString(),
    },
    batchProcessed: batch.length,
    meetLinksRepaired,
    completed: claim.complete,
    remaining: Math.max(0, updatedJob.totalCount - updatedJob.processedCount),
  };
}

type ReminderTask = {
  userId: string;
  dedupeKey: string;
  content: string;
  target: NotificationTarget;
};

export async function runReminderBatch() {
  await ensureSeededData();

  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_LEAD_MINUTES - REMINDER_WINDOW_MINUTES / 2) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMINDER_LEAD_MINUTES + REMINDER_WINDOW_MINUTES / 2) * 60 * 1000);

  const candidates = await prisma.session.findMany({
    where: {
      cancelled: false,
      startTime: {
        gte: windowStart,
        lt: windowEnd,
      },
      // An archived class has stopped; its students must not be reminded.
      class: { status: ClassStatus.ACTIVE },
    },
    include: {
      class: {
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              timezone: true,
              language: true,
              telegramChatId: true,
              pushSubscription: true,
              notificationPrefs: true,
            },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // Classes longer than 60 minutes are stored as back-to-back 60-minute segments.
  // Segment 2 must not trigger its own "starts at" reminder in the middle of the
  // class: skip any session that follows an earlier segment of the same class
  // ending at most SEGMENT_TRANSITION_WINDOW_MINUTES before it (the first
  // segment's reminder already carries the continuation link).
  const transitionMs = SEGMENT_TRANSITION_WINDOW_MINUTES * 60 * 1000;
  const precedingSegments = candidates.length
    ? await prisma.session.findMany({
      where: {
        classId: { in: Array.from(new Set(candidates.map((session) => session.classId))) },
        cancelled: false,
        endTime: { gte: new Date(windowStart.getTime() - transitionMs), lt: windowEnd },
      },
      select: { id: true, classId: true, endTime: true },
    })
    : [];
  const sessions = candidates.filter(
    (session) =>
      !precedingSegments.some(
        (earlier) =>
          earlier.classId === session.classId &&
          earlier.id !== session.id &&
          earlier.endTime.getTime() <= session.startTime.getTime() &&
          session.startTime.getTime() - earlier.endTime.getTime() <= transitionMs,
      ),
  );

  // Last chance for a missing Meet link before the reminder goes out: the full
  // retry pass only runs with the (daily) scheduler, so try again here for just
  // these sessions -- no extra query when every link is already there.
  const linkless = sessions.filter((session) => !session.meetLink || session.meetLinkStatus !== MeetLinkStatus.GENERATED);
  if (linkless.length > 0) {
    try {
      if ((await retryMissingMeetLinks(now, linkless.length, linkless.map((session) => session.id))) > 0) {
        const fresh = await prisma.session.findMany({
          where: { id: { in: linkless.map((session) => session.id) } },
          select: { id: true, meetLink: true, meetLinkStatus: true },
        });
        for (const row of fresh) {
          const session = sessions.find((item) => item.id === row.id);
          if (session) {
            session.meetLink = row.meetLink;
            session.meetLinkStatus = row.meetLinkStatus;
          }
        }
      }
    } catch (error) {
      console.error("[reminders] meet link retry failed", error);
    }
  }

  if (sessions.length === 0) {
    return {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      sessionsFound: 0,
      remindersCreated: 0,
      deliveriesSent: 0,
    };
  }

  const classIds = Array.from(new Set(sessions.map((session) => session.classId)));

  // Continuation candidates (next segment starting within the transition window
  // after a session ends). Fetch once for all classes instead of the old
  // per-session findFirst — that was part of the N+1.
  const maxEnd = sessions.reduce((max, session) => (session.endTime > max ? session.endTime : max), sessions[0].endTime);
  const continuationCandidates = await prisma.session.findMany({
    where: {
      classId: { in: classIds },
      cancelled: false,
      startTime: {
        gt: windowStart,
        lte: new Date(maxEnd.getTime() + SEGMENT_TRANSITION_WINDOW_MINUTES * 60 * 1000),
      },
    },
    select: { id: true, classId: true, startTime: true, endTime: true, meetLink: true },
    orderBy: { startTime: "asc" },
  });

  const findContinuation = (session: (typeof sessions)[number]) =>
    continuationCandidates.find(
      (candidate) =>
        candidate.classId === session.classId &&
        candidate.id !== session.id &&
        candidate.startTime.getTime() > session.endTime.getTime() &&
        candidate.startTime.getTime() <= session.endTime.getTime() + SEGMENT_TRANSITION_WINDOW_MINUTES * 60 * 1000,
    ) ?? null;

  // Batch all enrollments for the window's classes in a single query and group by
  // class (was one findMany per session inside the loop).
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: { in: classIds }, status: EnrollmentStatus.ACTIVE },
    include: {
      student: {
        select: {
          id: true,
          email: true,
          phone: true,
          timezone: true,
          language: true,
          telegramChatId: true,
          pushSubscription: true,
          notificationPrefs: true,
        },
      },
    },
  });

  const enrollmentsByClass = new Map<string, typeof enrollments>();
  for (const enrollment of enrollments) {
    const list = enrollmentsByClass.get(enrollment.classId);
    if (list) {
      list.push(enrollment);
    } else {
      enrollmentsByClass.set(enrollment.classId, [enrollment]);
    }
  }

  // Build every reminder task (students + teacher) with pre-rendered content.
  const tasks: ReminderTask[] = [];

  for (const session of sessions) {
    const continuation = findContinuation(session);
    const continuationInput = continuation
      ? { startTime: continuation.startTime, meetLink: continuation.meetLink }
      : null;

    for (const enrollment of enrollmentsByClass.get(session.classId) ?? []) {
      tasks.push({
        userId: enrollment.student.id,
        // The start time is part of the key: a session rescheduled after its
        // reminder went out gets a fresh reminder for the new time.
        dedupeKey: `session_reminder:${session.id}:${session.startTime.getTime()}:${enrollment.student.id}`,
        content: buildSessionReminderContent({
          language: enrollment.student.language,
          timezone: enrollment.student.timezone,
          className: session.class.name,
          teacherName: session.class.teacher.name,
          startTime: session.startTime,
          meetLink: session.meetLink,
          continuation: continuationInput,
        }),
        target: {
          userId: enrollment.student.id,
          email: enrollment.student.email,
          phone: enrollment.student.phone,
          telegramChatId: enrollment.student.telegramChatId,
          pushSubscription: enrollment.student.pushSubscription,
          notificationPrefs: enrollment.student.notificationPrefs,
        },
      });
    }

    const teacher = session.class.teacher;
    tasks.push({
      userId: teacher.id,
      dedupeKey: `session_reminder:${session.id}:${session.startTime.getTime()}:teacher:${teacher.id}`,
      content: buildTeacherSessionReminderContent({
        language: teacher.language,
        timezone: teacher.timezone,
        className: session.class.name,
        startTime: session.startTime,
        meetLink: session.meetLink,
        continuation: continuationInput,
      }),
      target: {
        userId: teacher.id,
        email: teacher.email,
        phone: teacher.phone,
        telegramChatId: teacher.telegramChatId,
        pushSubscription: teacher.pushSubscription,
        notificationPrefs: teacher.notificationPrefs,
      },
    });
  }

  // Batch the dedupe lookups: a single query for every candidate key, instead of a
  // findFirst per recipient.
  const dedupeKeys = tasks.map((task) => task.dedupeKey);
  const existingRows = await prisma.notification.findMany({
    where: { dedupeKey: { in: dedupeKeys }, status: { not: NotificationStatus.FAILED } },
    select: { dedupeKey: true },
  });
  const alreadyHandled = new Set(
    existingRows.map((row) => row.dedupeKey).filter((key): key is string => key !== null),
  );

  const pending = tasks.filter((task) => !alreadyHandled.has(task.dedupeKey));

  // Claim-then-send: reserve the reminder with an atomic conditional insert on the
  // unique (dedupeKey, channel) BEFORE performing the external send. The previous
  // code sent first and wrote the dedupe row afterwards, so two overlapping cron
  // runs (or a slow provider) double-sent every reminder. Now a second run's claim
  // insert conflicts and it skips. Deliveries fan out with bounded concurrency
  // rather than a sequential await-per-recipient loop.
  const claimAndSend = async (task: ReminderTask): Promise<{ claimed: boolean; sent: boolean }> => {
    const claim = await prisma.notification.createMany({
      data: [
        {
          userId: task.userId,
          dedupeKey: task.dedupeKey,
          channel: NotificationChannel.PLATFORM,
          content: task.content,
          status: NotificationStatus.PENDING,
        },
      ],
      skipDuplicates: true,
    });

    if (claim.count === 0) {
      // Another overlapping run already owns this reminder.
      return { claimed: false, sent: false };
    }

    try {
      const deliveries = await deliverWithFallback(task.target, task.content);
      // deliverWithFallback always ends with an in-app PLATFORM "SENT", so that
      // alone says nothing about whether the student was reached. Retry only when
      // a real channel failed in a way a later run could fix (e.g. SMTP 535); a
      // student with no usable channel at all is done, not retried every tick.
      const sent = landedOnRealChannel(deliveries) || !deliveryNeedsRetry(deliveries);

      if (sent) {
        await prisma.notification.updateMany({
          where: { dedupeKey: task.dedupeKey, channel: NotificationChannel.PLATFORM },
          data: { status: NotificationStatus.SENT, sentAt: new Date() },
        });
        return { claimed: true, sent: true };
      }

      // No channel succeeded: release the claim so a later batch can retry (this
      // preserves the old "retry when not already SENT" behavior) without leaving a
      // non-FAILED row that would permanently block the reclaim.
      await prisma.notification.deleteMany({
        where: { dedupeKey: task.dedupeKey, channel: NotificationChannel.PLATFORM, status: NotificationStatus.PENDING },
      });
      return { claimed: true, sent: false };
    } catch (err) {
      console.error("Reminder delivery failed:", err);
      await prisma.notification.deleteMany({
        where: { dedupeKey: task.dedupeKey, channel: NotificationChannel.PLATFORM, status: NotificationStatus.PENDING },
      });
      return { claimed: true, sent: false };
    }
  };

  const results = await mapWithConcurrency(pending, DELIVERY_CONCURRENCY, claimAndSend);

  let remindersCreated = 0;
  let deliveriesSent = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value.claimed) {
        remindersCreated += 1;
      }
      if (result.value.sent) {
        deliveriesSent += 1;
      }
    }
  }

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    sessionsFound: sessions.length,
    remindersCreated,
    deliveriesSent,
  };
}

export async function listTodaySessions() {
  await ensureSeededData();

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

  const sessions = await prisma.session.findMany({
    where: {
      startTime: {
        gte: start,
        lt: end,
      },
      cancelled: false,
    },
    include: {
      class: {
        include: {
          teacher: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: {
      startTime: "asc",
    },
  });

  const counts = sessions.length
    ? await prisma.enrollment.groupBy({
      by: ["classId"],
      where: {
        classId: { in: sessions.map((item) => item.classId) },
        status: EnrollmentStatus.ACTIVE,
      },
      _count: { _all: true },
    })
    : [];

  const countMap = new Map(counts.map((item) => [item.classId, item._count._all]));

  return sessions.map((session) => ({
    id: session.id,
    className: session.class.name,
    teacherName: session.class.teacher.name,
    studentCount: countMap.get(session.classId) ?? 0,
    meetLinkStatus: session.meetLinkStatus,
    startTime: session.startTime.toISOString(),
  }));
}

export async function getDashboardStats() {
  await ensureSeededData();

  const [activeClasses, students, teachers, sessionsToday] = await Promise.all([
    prisma.class.count({ where: { status: ClassStatus.ACTIVE } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    listTodaySessions(),
  ]);

  return {
    activeClasses,
    students,
    teachers,
    sessionsToday: sessionsToday.length,
  };
}

/**
 * A teacher's OWN numbers for their dashboard: their active classes, the students
 * in them, and their sessions today and over the next seven days. The dashboard
 * used to show every teacher the whole platform's totals ("16 classes, 154
 * students"), which said nothing about their own week.
 *
 * "Today" is the Kabul calendar day, which is the day the teacher's students live in.
 */
export async function getTeacherDashboardStats(teacherId: string, now: Date = new Date()) {
  const KABUL_OFFSET_MS = (4 * 60 + 30) * 60_000;
  const kabulNow = new Date(now.getTime() + KABUL_OFFSET_MS);
  const dayStart = new Date(
    Date.UTC(kabulNow.getUTCFullYear(), kabulNow.getUTCMonth(), kabulNow.getUTCDate()) - KABUL_OFFSET_MS,
  );
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  const mine = { teacherId, status: ClassStatus.ACTIVE };

  const [activeClasses, students, sessionsToday, sessionsThisWeek] = await Promise.all([
    prisma.class.count({ where: mine }),
    // Distinct people: a student in two of this teacher's classes counts once.
    prisma.enrollment
      .findMany({
        where: { status: EnrollmentStatus.ACTIVE, class: mine },
        distinct: ["studentId"],
        select: { studentId: true },
      })
      .then((rows) => rows.length),
    prisma.session.count({
      where: { cancelled: false, class: mine, startTime: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.session.count({
      where: { cancelled: false, class: mine, startTime: { gte: now, lt: weekEnd } },
    }),
  ]);

  return { activeClasses, students, sessionsToday, sessionsThisWeek };
}

export async function listWebinars() {
  await ensureSeededData();

  const items = await prisma.webinar.findMany({
    orderBy: { startsAt: "asc" },
    take: 200,
  });

  return items.map((item) => ({
    ...item,
    startsAt: item.startsAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
}

export async function createWebinar(input: CreateWebinarInput) {
  await ensureSeededData();

  const row = await prisma.webinar.create({
    data: {
      title: input.title,
      description: input.description,
      startsAt: new Date(input.startsAt),
      meetLink: input.meetLink,
      language: input.language,
    },
  });

  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRegisteredWebinarIds(userId: string) {
  await ensureSeededData();

  const rows = await prisma.webinarRegistration.findMany({
    where: { userId },
    select: { webinarId: true },
  });

  return rows.map((row) => row.webinarId);
}

export async function registerForWebinar(webinarId: string, userId: string) {
  await ensureSeededData();

  const webinar = await prisma.webinar.findUnique({ where: { id: webinarId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!webinar) {
    throw new Error("Webinar not found");
  }

  if (!user) {
    throw new Error("User not found");
  }

  const existing = await prisma.webinarRegistration.findUnique({
    where: {
      webinarId_userId: {
        webinarId,
        userId,
      },
    },
  });

  if (existing) {
    return {
      ...existing,
      registeredAt: existing.registeredAt.toISOString(),
    };
  }

  const registration = await prisma.webinarRegistration.create({
    data: {
      webinarId,
      userId,
    },
  });

  const content = `Webinar registration confirmed: ${webinar.title} at ${webinar.startsAt.toISOString()}. Join: ${webinar.meetLink
    }`;

  const deliveries = await deliverWithFallback(
    {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      telegramChatId: user.telegramChatId,
      pushSubscription: user.pushSubscription,
      // Without this the confirmation ignored a user's opt-outs.
      notificationPrefs: user.notificationPrefs,
    },
    content,
  );

  if (deliveries.length > 0) {
    await prisma.notification.createMany({
      data: deliveries.map((delivery) => ({
        userId: user.id,
        channel: delivery.channel,
        content,
        status: delivery.status,
        sentAt: new Date(),
      })),
    });
  }

  return {
    ...registration,
    registeredAt: registration.registeredAt.toISOString(),
  };
}

export async function listOpportunities(type?: string) {
  await ensureSeededData();

  const items = await prisma.opportunity.findMany({
    where: {
      ...(type ? { type: type as "SCHOLARSHIP" | "JOB" | "INTERNSHIP" | "GRANT" } : {}),
    },
    orderBy: {
      deadline: "asc",
    },
    take: 200,
  });

  const now = Date.now();

  return items
    .map((item) => ({
      ...item,
      deadline: item.deadline.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      expired: item.deadline.getTime() < now,
    }))
    .sort((a, b) => {
      if (a.expired !== b.expired) {
        return a.expired ? 1 : -1;
      }

      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
}

export async function createOpportunity(input: CreateOpportunityInput) {
  await ensureSeededData();

  const row = await prisma.opportunity.create({
    data: {
      title: input.title,
      type: input.type,
      description: input.description,
      deadline: new Date(input.deadline),
      externalUrl: input.externalUrl,
    },
  });

  return {
    ...row,
    deadline: row.deadline.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listLibraryResources(query?: string) {
  await ensureSeededData();

  const search = normalizeSearch(query);

  const items = await prisma.libraryResource.findMany({
    where: search
      ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { author: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      }
      : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
}

export async function createLibraryResource(input: CreateLibraryInput) {
  await ensureSeededData();

  const row = await prisma.libraryResource.create({
    data: {
      title: input.title,
      author: input.author,
      category: input.category,
      fileUrl: input.fileUrl,
      fileSize: input.fileSize,
      externalUrl: input.externalUrl,
    },
  });

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listClassMaterials(classId: string) {
  await ensureSeededData();

  const items = await prisma.material.findMany({
    where: {
      classId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function createClassMaterial(input: CreateMaterialInput) {
  await ensureSeededData();

  const row = await prisma.material.create({
    data: {
      classId: input.classId,
      title: input.title,
      fileUrl: input.fileUrl,
      fileSize: input.fileSize,
      uploadedBy: input.uploadedBy,
    },
  });

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUserNotifications(userId: string, limit: number = DEFAULT_NOTIFICATION_LIMIT) {
  await ensureSeededData();

  // Return only the most recent slice, newest first. Previously this loaded the
  // user's ENTIRE notification history (unbounded, growing forever). Order by
  // createdAt so PENDING rows (sentAt = null) are not sorted to the bottom.
  const take = Math.min(MAX_NOTIFICATION_LIMIT, Math.max(1, Math.floor(limit)));

  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((item) => ({
    ...item,
    sentAt: item.sentAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function getUser(userId: string) {
  await ensureSeededData();

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
}

// ─── Attendance Tracking (BRD US-13) ─────────────────────────────────

/**
 * Get attendance records for a session, including all enrolled students.
 */
export async function getSessionAttendance(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      class: {
        select: { id: true, name: true },
      },
      attendance: {
        select: {
          id: true,
          studentId: true,
          attended: true,
          joinedAt: true,
          checkinVerified: true,
          checkinAt: true,
          student: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!session) return null;

  // Get all enrolled students for this class
  const enrollments = await prisma.enrollment.findMany({
    where: {
      classId: session.class.id,
      status: EnrollmentStatus.ACTIVE,
    },
    include: {
      student: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // Merge attendance records with enrollment list
  const attendanceMap = new Map(
    session.attendance.map((a) => [a.studentId, a]),
  );

  const students = enrollments.map((e) => {
    const record = attendanceMap.get(e.student.id);
    return {
      studentId: e.student.id,
      studentName: e.student.name,
      studentEmail: e.student.email,
      attended: record?.attended ?? false,
      joinedAt: record?.joinedAt?.toISOString() ?? null,
      checkinVerified: record?.checkinVerified ?? false,
      checkinAt: record?.checkinAt?.toISOString() ?? null,
    };
  });

  return {
    sessionId: session.id,
    classId: session.class.id,
    className: session.class.name,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
    students,
  };
}

/**
 * Mark a student as present or absent for a session.
 */
export async function markAttendance(
  sessionId: string,
  studentId: string,
  attended: boolean,
) {
  const record = await prisma.attendance.upsert({
    where: {
      sessionId_studentId: { sessionId, studentId },
    },
    update: {
      attended,
      joinedAt: attended ? new Date() : null,
    },
    create: {
      sessionId,
      studentId,
      attended,
      joinedAt: attended ? new Date() : null,
    },
  });

  return {
    id: record.id,
    sessionId: record.sessionId,
    studentId: record.studentId,
    attended: record.attended,
    joinedAt: record.joinedAt?.toISOString() ?? null,
  };
}

/**
 * Get attendance summary for all sessions in a class.
 */
export async function getClassAttendanceSummary(classId: string) {
  // Aggregate in the database instead of pulling every attendance row and matching
  // in JS (which was O(students × sessions) and loaded the full attendance table
  // for the class). Attendance is unique per (sessionId, studentId), so counting
  // rows equals counting distinct sessions attended/verified.
  // Only sessions that have started count: a future session nobody could have
  // attended yet would drag every student's attendance rate down.
  const sessions = await prisma.session.findMany({
    where: { classId, cancelled: false, startTime: { lte: new Date() } },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  const totalSessions = sessionIds.length;

  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: EnrollmentStatus.ACTIVE },
    include: {
      student: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const [attendedGroups, verifiedGroups] = sessionIds.length
    ? await Promise.all([
      prisma.attendance.groupBy({
        by: ["studentId"],
        where: { sessionId: { in: sessionIds }, attended: true },
        _count: { _all: true },
      }),
      prisma.attendance.groupBy({
        by: ["studentId"],
        where: { sessionId: { in: sessionIds }, checkinVerified: true },
        _count: { _all: true },
      }),
    ])
    : [[], []];

  const attendedMap = new Map(attendedGroups.map((g) => [g.studentId, g._count._all]));
  const verifiedMap = new Map(verifiedGroups.map((g) => [g.studentId, g._count._all]));

  const studentStats = enrollments.map((e) => {
    const present = attendedMap.get(e.student.id) ?? 0;
    const verified = verifiedMap.get(e.student.id) ?? 0;
    return {
      studentId: e.student.id,
      studentName: e.student.name,
      studentEmail: e.student.email,
      sessionsAttended: present,
      sessionsVerified: verified,
      totalSessions,
      attendanceRate: totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0,
      verificationRate: totalSessions > 0 ? Math.round((verified / totalSessions) * 100) : 0,
    };
  });

  return {
    classId,
    totalSessions,
    totalStudents: enrollments.length,
    students: studentStats,
  };
}

/**
 * List classes assigned to a teacher with recent sessions and enrollment counts.
 */
export async function listTeacherClasses(teacherId: string) {
  const classes = await prisma.class.findMany({
    where: { teacherId, status: ClassStatus.ACTIVE },
    include: {
      sessions: { orderBy: { startTime: "desc" }, take: 5 },
      _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } } },
    },
    orderBy: { name: "asc" },
  });

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    subjectCategory: c.subjectCategory,
    schedule: c.schedulePreference,
    durationMinutes: c.durationMinutes,
    enrolledCount: c._count.enrollments,
    sessions: c.sessions.map((s) => ({
      id: s.id,
      startTime: s.startTime.toISOString(),
      meetLinkStatus: s.meetLinkStatus,
    })),
  }));
}

/**
 * Get student attendance history across all enrolled classes.
 */
export async function getStudentAttendanceHistory(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: EnrollmentStatus.ACTIVE },
    include: {
      class: { select: { id: true, name: true } },
    },
  });

  const classIds = enrollments.map((e) => e.class.id);

  // Replace the per-class N+1 (two queries per enrolled class) with three total
  // queries: sessions for all classes, then this student's attended rows across
  // all of those sessions.
  const sessions = classIds.length
    ? await prisma.session.findMany({
      where: { classId: { in: classIds }, cancelled: false },
      select: { id: true, classId: true },
    })
    : [];

  const sessionClassMap = new Map(sessions.map((s) => [s.id, s.classId]));
  const totalByClass = new Map<string, number>();
  for (const s of sessions) {
    totalByClass.set(s.classId, (totalByClass.get(s.classId) ?? 0) + 1);
  }

  const attendedRows = sessions.length
    ? await prisma.attendance.findMany({
      where: {
        studentId,
        attended: true,
        sessionId: { in: sessions.map((s) => s.id) },
      },
      select: { sessionId: true },
    })
    : [];

  const attendedByClass = new Map<string, number>();
  for (const row of attendedRows) {
    const classId = sessionClassMap.get(row.sessionId);
    if (classId) {
      attendedByClass.set(classId, (attendedByClass.get(classId) ?? 0) + 1);
    }
  }

  const classAttendance = enrollments.map((e) => {
    const totalSessions = totalByClass.get(e.class.id) ?? 0;
    const attended = attendedByClass.get(e.class.id) ?? 0;
    return {
      classId: e.class.id,
      className: e.class.name,
      totalSessions,
      sessionsAttended: attended,
      attendanceRate: totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0,
    };
  });

  const totalSessions = classAttendance.reduce((sum, c) => sum + c.totalSessions, 0);
  const totalAttended = classAttendance.reduce((sum, c) => sum + c.sessionsAttended, 0);

  return {
    classes: classAttendance,
    overallRate: totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0,
  };
}

/**
 * Get admin analytics: user breakdown, class stats, and overall attendance.
 */
export async function getAdminAnalytics() {
  await ensureSeededData();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalUsers,
    usersByRoleRaw,
    approvedCount,
    totalCount,
    recentSignups,
    totalClasses,
    activeClasses,
    totalEnrollments,
    totalAttendanceRecords,
    attendedCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    prisma.user.count({ where: { approvedAt: { not: null } } }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.class.count(),
    prisma.class.count({ where: { status: ClassStatus.ACTIVE } }),
    prisma.enrollment.count({ where: { status: EnrollmentStatus.ACTIVE } }),
    prisma.attendance.count(),
    prisma.attendance.count({ where: { attended: true } }),
  ]);

  const byRole: Record<string, number> = {};
  for (const row of usersByRoleRaw) {
    byRole[row.role] = row._count.id;
  }

  const pendingCount = totalCount - approvedCount;
  const byStatus: Record<string, number> = {
    APPROVED: approvedCount,
    PENDING: pendingCount,
  };

  const overallRate = totalAttendanceRecords > 0
    ? Math.round((attendedCount / totalAttendanceRecords) * 100)
    : 0;

  return {
    users: {
      total: totalUsers,
      byRole,
      byStatus,
      recentSignups,
    },
    classes: {
      total: totalClasses,
      active: activeClasses,
      totalEnrollments,
    },
    attendance: {
      overallRate,
    },
  };
}

export function parseInteger(input: string | null, fallback: number) {
  if (!input) {
    return fallback;
  }

  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.floor(parsed);
}

/** Students waiting on an admin decision for a class. */
export async function listPendingEnrollments(classId: string) {
  const rows = await prisma.enrollment.findMany({
    where: { classId, status: EnrollmentStatus.PENDING },
    include: { student: { select: { id: true, name: true, email: true } } },
    orderBy: { enrolledAt: "asc" },
  });
  return rows.map((e) => ({
    enrollmentId: e.id,
    studentId: e.student.id,
    name: e.student.name,
    email: e.student.email,
    requestedAt: e.enrolledAt.toISOString(),
  }));
}

/** Every pending course request across the platform, for the daily digest. */
export async function countPendingEnrollments() {
  return prisma.enrollment.count({ where: { status: EnrollmentStatus.PENDING } });
}

/**
 * Pending course requests grouped by the class they are waiting on.
 *
 * A single platform-wide total is not actionable: the approve/reject controls
 * live on each class's own page, so an admin who only knows "5 waiting" still
 * has to open classes one by one to find them. The per-class split turns the
 * dashboard into a work list you can click straight through.
 *
 * Sorted longest-waiting first — the queue nobody has touched is the one most
 * likely to have already lost the student.
 */
export async function groupPendingEnrollmentsByClass() {
  const grouped = await prisma.enrollment.groupBy({
    by: ["classId"],
    where: { status: EnrollmentStatus.PENDING },
    _count: { _all: true },
    _min: { enrolledAt: true },
  });

  if (grouped.length === 0) {
    return [];
  }

  const classes = await prisma.class.findMany({
    where: { id: { in: grouped.map((g) => g.classId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(classes.map((c) => [c.id, c.name]));

  return grouped
    .map((g) => ({
      classId: g.classId,
      // A request can outlive its class only if the class row was removed, which
      // cascades — but fall back rather than render "undefined" if it ever does.
      className: nameById.get(g.classId) ?? "Unknown class",
      count: g._count._all,
      oldestRequestedAt: g._min.enrolledAt ? g._min.enrolledAt.toISOString() : null,
    }))
    .sort((a, b) => (a.oldestRequestedAt ?? "").localeCompare(b.oldestRequestedAt ?? ""));
}

/**
 * Admit or turn down a course request.
 *
 * Capacity is re-checked at approval time, not just at request time: a class can
 * fill up while requests sit in the queue, and silently oversubscribing it would
 * put more students in the room than the teacher agreed to.
 */
export async function decideEnrollment(
  enrollmentId: string,
  decision: "APPROVE" | "REJECT",
) {
  const existing = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, classId: true, studentId: true, status: true },
  });
  if (!existing) return { status: "NOT_FOUND" as const };
  if (existing.status !== EnrollmentStatus.PENDING) {
    return { status: "NOT_PENDING" as const, current: existing.status };
  }

  if (decision === "REJECT") {
    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: EnrollmentStatus.REJECTED },
      select: { id: true, status: true, studentId: true, classId: true },
    });
    return { status: "REJECTED" as const, enrollment: updated };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`enroll:${existing.classId}`}))`;

    const klass = await tx.class.findUnique({
      where: { id: existing.classId },
      select: { maxStudents: true, status: true },
    });
    if (!klass || klass.status !== ClassStatus.ACTIVE) {
      return { status: "CLASS_UNAVAILABLE" as const };
    }

    const activeCount = await tx.enrollment.count({
      where: { classId: existing.classId, status: EnrollmentStatus.ACTIVE },
    });
    if (activeCount >= klass.maxStudents) {
      return { status: "CLASS_FULL" as const };
    }

    const updated = await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { status: EnrollmentStatus.ACTIVE, enrolledAt: new Date() },
      select: { id: true, status: true, studentId: true, classId: true },
    });
    return { status: "APPROVED" as const, enrollment: updated };
  });
}
