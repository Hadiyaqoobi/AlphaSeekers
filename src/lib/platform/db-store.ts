import type { UserRole } from "@prisma/client";
import { ClassStatus, EnrollmentStatus, MeetLinkStatus, NotificationStatus, SchedulerJobStatus } from "@prisma/client";

import { DEMO_USERS } from "@/lib/constants";
import { generateMeetLink } from "@/lib/integrations/meet";
import { deliverWithFallback } from "@/lib/integrations/notifications";
import { classCatalog } from "@/lib/mock-data";
import { prisma } from "@/lib/prisma";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";

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
};

type UpdateClassInput = Partial<CreateClassInput>;

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
  fileUrl: string;
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

const MAX_PAGE_SIZE = 10;
const FREE_MEET_SEGMENT_MINUTES = 60;
const SEGMENT_BREAK_MINUTES = 10;
const SEGMENT_TRANSITION_WINDOW_MINUTES = 15;
const REMINDER_LEAD_MINUTES = 60;
const REMINDER_WINDOW_MINUTES = 10;
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

function nextWeekdayDate(dayOfWeek: number, hour: number, minute: number) {
  const now = new Date();
  const next = new Date(now);
  const daysToAdd = (dayOfWeek - now.getUTCDay() + 7) % 7 || 7;
  next.setUTCDate(now.getUTCDate() + daysToAdd);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
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
  return Math.min(MAX_PAGE_SIZE, Math.max(1, limit ?? MAX_PAGE_SIZE));
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

function formatDateTimeForUser(date: Date, timezone: string | null | undefined, language: "FA" | "EN") {
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

  const base = `Reminder: ${input.className} starts in 1 hour.\nTeacher: ${input.teacherName}\nTime: ${when}\nJoin: ${joinText}`;
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

  const base = `Teacher reminder: Your class "${input.className}" starts in 1 hour.\nTime: ${when}\nJoin: ${joinText}`;
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

export async function ensureSeededData() {
  warnIfInsecureProductionConfig();

  if (seeded) {
    return;
  }

  if (!runtime.allowAutoSeed) {
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

  const where = {
    status: ClassStatus.ACTIVE,
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
        nextSessionStart: nextSession?.startTime.toISOString() ?? null,
        meetLink: nextSession?.meetLink ?? null,
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

export async function getClassById(classId: string) {
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

  if (!klass || klass.status === ClassStatus.ARCHIVED) {
    return null;
  }

  const [sessions, materials, enrollmentCount] = await Promise.all([
    prisma.session.findMany({
      where: { classId },
      orderBy: { startTime: "asc" },
    }),
    prisma.material.findMany({
      where: { classId },
      orderBy: { createdAt: "desc" },
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
    status: klass.status,
    createdAt: klass.createdAt.toISOString(),
    updatedAt: klass.updatedAt.toISOString(),
    teacherName: klass.teacher.name,
    enrolledCount: enrollmentCount,
    sessions: sessions.map((session) => ({
      ...session,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      createdAt: session.createdAt.toISOString(),
    })),
    materials: materials.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

// Announcements are stored in-memory (no DB table yet)
// They persist for the server lifetime and get delivered as notifications
const announcementStore: Array<{ id: string; classId: string; authorId: string; authorName: string; content: string; createdAt: string }> = [];

export function listClassAnnouncements(classId: string) {
  return announcementStore
    .filter((a) => a.classId === classId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createClassAnnouncement(input: { classId: string; authorId: string; authorName: string; content: string }) {
  const record = {
    id: `announcement_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  announcementStore.unshift(record);
  return record;
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

export async function listAdminClasses(params: ClassListParams = {}) {
  await ensureSeededData();

  const page = Math.max(1, params.page ?? 1);
  const limit = clampLimit(params.limit);
  const search = normalizeSearch(params.search);

  const where = {
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

  return prisma.class.create({
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
      // These columns require prisma db push; cast to bypass generated types
      ...(input.registrationFormUrl ? { registrationFormUrl: input.registrationFormUrl } : {}),
      ...(({ published: true }) as Record<string, unknown>),
    } as Parameters<typeof prisma.class.create>[0]["data"],
  });
}

export async function createClassWithSession(input: CreateClassInput) {
  await ensureSeededData();

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
      // These columns require prisma db push; cast to bypass generated types
      ...(input.registrationFormUrl ? { registrationFormUrl: input.registrationFormUrl } : {}),
      ...(({ published: true }) as Record<string, unknown>),
    } as Parameters<typeof prisma.class.create>[0]["data"],
  });

  // 2. Calculate session start time from schedule preference
  const fallback = parseScheduleTime(input.schedulePreference ?? "5:00 PM");
  const fallbackDay = parseScheduleDay(input.schedulePreference ?? "Sat");

  // Check teacher availability first, fall back to schedule preference
  const availability = await prisma.teacherAvailability.findFirst({
    where: { teacherId: input.teacherId },
    orderBy: [{ dayOfWeek: "asc" }, { startTimeUTC: "asc" }],
  });

  let startDate: Date;

  if (availability) {
    const hour = availability.startTimeUTC.getUTCHours();
    const minute = availability.startTimeUTC.getUTCMinutes();
    startDate = nextWeekdayDate(availability.dayOfWeek, hour, minute);
  } else {
    startDate = nextWeekdayDate(fallbackDay, fallback.hour, fallback.minute);
  }

  // 3. Build session windows (handles multi-segment classes)
  const durationMinutes = normalizeDurationMinutes(input.durationMinutes);
  let windows = buildSegmentWindows(startDate, durationMinutes);
  let shiftAttempts = 0;

  while (await hasTeacherConflictForWindows(input.teacherId, windows)) {
    if (shiftAttempts >= 8) break;
    startDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    windows = buildSegmentWindows(startDate, durationMinutes);
    shiftAttempts += 1;
  }

  // 4. Create sessions with Meet links
  const createdSessions = [];

  for (const window of windows) {
    const meet = await generateMeetLink(klass.name, window.startTime.toISOString(), {
      endIso: window.endTime.toISOString(),
      teacherId: input.teacherId,
    });

    const session = await prisma.session.create({
      data: {
        classId: klass.id,
        startTime: window.startTime,
        endTime: window.endTime,
        meetLink: meet.link,
        meetLinkStatus:
          meet.status === "FAILED"
            ? MeetLinkStatus.FAILED
            : meet.status === "PENDING"
              ? MeetLinkStatus.PENDING
              : MeetLinkStatus.GENERATED,
        cancelled: false,
      },
    });

    createdSessions.push({
      ...session,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      createdAt: session.createdAt.toISOString(),
    });
  }

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
    registrationFormUrl: (klass as Record<string, unknown>).registrationFormUrl ?? null,
  };
}

export async function updateClass(classId: string, input: UpdateClassInput) {
  await ensureSeededData();

  const existing = await prisma.class.findUnique({ where: { id: classId } });

  if (!existing) {
    return null;
  }

  return prisma.class.update({
    where: { id: classId },
    data: {
      ...input,
      ...(input.durationMinutes !== undefined
        ? {
          durationMinutes: normalizeDurationMinutes(input.durationMinutes),
        }
        : {}),
    },
  });
}

export async function archiveClass(classId: string) {
  await ensureSeededData();

  const existing = await prisma.class.findUnique({ where: { id: classId } });

  if (!existing) {
    return null;
  }

  return prisma.class.update({
    where: { id: classId },
    data: {
      status: ClassStatus.ARCHIVED,
    },
  });
}

export async function enrollStudentInClass(studentId: string, classId: string) {
  await ensureSeededData();

  const student = await prisma.user.findUnique({ where: { id: studentId } });

  if (!student || student.role !== "STUDENT") {
    throw new Error("Student not found");
  }

  const klass = await prisma.class.findUnique({ where: { id: classId } });

  if (!klass || klass.status !== ClassStatus.ACTIVE) {
    throw new Error("Class not found");
  }

  const existing = await prisma.enrollment.findUnique({
    where: {
      studentId_classId: {
        studentId,
        classId,
      },
    },
  });

  if (existing?.status === EnrollmentStatus.ACTIVE) {
    return {
      enrollment: {
        ...existing,
        enrolledAt: existing.enrolledAt.toISOString(),
      },
      state: "ALREADY_ENROLLED" as const,
    };
  }

  const activeCount = await prisma.enrollment.count({
    where: {
      classId,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  if (activeCount >= klass.maxStudents) {
    throw new Error("Class is full");
  }

  const enrollment = existing
    ? await prisma.enrollment.update({
      where: {
        studentId_classId: {
          studentId,
          classId,
        },
      },
      data: {
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: new Date(),
      },
    })
    : await prisma.enrollment.create({
      data: {
        studentId,
        classId,
        status: EnrollmentStatus.ACTIVE,
      },
    });

  const upcomingSessions = await prisma.session.findMany({
    where: {
      classId,
      startTime: { gte: new Date() },
      cancelled: false,
    },
    orderBy: { startTime: "asc" },
    take: 8,
  });

  const teacher = await prisma.user.findUnique({
    where: { id: klass.teacherId },
    select: { id: true, name: true, email: true, phone: true, language: true, telegramChatId: true, pushSubscription: true, notificationPrefs: true },
  });

  let content = `You are enrolled in ${klass.name}!`;

  if (teacher) {
    content += ` Lecturer: ${teacher.name}.`;
  }

  if (klass.schedulePreference) {
    content += ` Schedule: ${klass.schedulePreference}.`;
  }

  if (upcomingSessions.length > 0) {
    content += ` Upcoming sessions:`;
    upcomingSessions.forEach((session, index) => {
      content += ` (${index + 1}) ${session.startTime.toISOString()} — ${session.meetLink ?? "Meet link pending"}.`;
    });
  } else {
    content += ` Session schedule is being prepared.`;
  }

  const deliveries = await deliverWithFallback(
    {
      userId: student.id,
      email: student.email,
      phone: student.phone,
      telegramChatId: student.telegramChatId,
      pushSubscription: student.pushSubscription,
    },
    content,
  );

  if (deliveries.length > 0) {
    await prisma.notification.createMany({
      data: deliveries.map((delivery) => ({
        userId: student.id,
        channel: delivery.channel,
        content,
        status: delivery.status,
        sentAt: new Date(),
      })),
    });
  }

  // Notify teacher about new enrollment
  try {
    if (teacher) {
      const currentCount = activeCount + 1;
      const teacherContent = teacher.language === "FA"
        ? `شاگرد جدید "${student.name}" در صنف "${klass.name}" ثبت‌نام کرد. (${currentCount}/${klass.maxStudents})`
        : `New student "${student.name}" enrolled in "${klass.name}". (${currentCount}/${klass.maxStudents} enrolled)`;

      const teacherDeliveries = await deliverWithFallback(
        { userId: teacher.id, email: teacher.email, phone: teacher.phone, telegramChatId: teacher.telegramChatId, pushSubscription: teacher.pushSubscription },
        teacherContent,
      );

      if (teacherDeliveries.length > 0) {
        await prisma.notification.createMany({
          data: teacherDeliveries.map((delivery) => ({
            userId: teacher.id,
            dedupeKey: `enrollment_notify:${enrollment.id}:${teacher.id}`,
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
    console.error("Failed to notify teacher about enrollment:", err);
  }

  return {
    enrollment: {
      ...enrollment,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    },
    state: "ENROLLED" as const,
    deliveries,
  };
}

export async function dropStudentFromClass(studentId: string, classId: string) {
  await ensureSeededData();

  const existing = await prisma.enrollment.findUnique({
    where: {
      studentId_classId: {
        studentId,
        classId,
      },
    },
  });

  if (!existing) {
    return null;
  }

  return prisma.enrollment.update({
    where: {
      studentId_classId: {
        studentId,
        classId,
      },
    },
    data: {
      status: EnrollmentStatus.DROPPED,
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

  const sessions = classIds.length
    ? await prisma.session.findMany({
      where: {
        classId: { in: classIds },
        cancelled: false,
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

export async function listStudentSchedule(studentId: string) {
  await ensureSeededData();

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

export async function getJoinNowSession(studentId: string) {
  const schedule = await listStudentSchedule(studentId);
  const now = Date.now();
  const lookback = 15 * 60 * 1000;

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

async function hasTeacherConflict(teacherId: string, startTime: Date, endTime: Date) {
  const conflict = await prisma.session.findFirst({
    where: {
      cancelled: false,
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

async function hasTeacherConflictForWindows(
  teacherId: string,
  windows: Array<{ startTime: Date; endTime: Date }>,
) {
  for (const window of windows) {
    if (await hasTeacherConflict(teacherId, window.startTime, window.endTime)) {
      return true;
    }
  }

  return false;
}

export async function scheduleTeacherClasses(teacherId: string) {
  await ensureSeededData();

  const now = new Date();
  const teacherClasses = await prisma.class.findMany({
    where: { teacherId, status: ClassStatus.ACTIVE },
  });

  let sessionsCreated = 0;

  for (const klass of teacherClasses) {
    const hasUpcoming = await prisma.session.findFirst({
      where: {
        classId: klass.id,
        cancelled: false,
        startTime: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    });

    if (hasUpcoming) continue;

    const availability = await prisma.teacherAvailability.findFirst({
      where: { teacherId },
      orderBy: [{ dayOfWeek: "asc" }, { startTimeUTC: "asc" }],
    });

    let startDate: Date;

    if (availability) {
      const hour = availability.startTimeUTC.getUTCHours();
      const minute = availability.startTimeUTC.getUTCMinutes();
      startDate = nextWeekdayDate(availability.dayOfWeek, hour, minute);
    } else {
      const fallback = parseScheduleTime(klass.schedulePreference ?? "5:00 PM");
      const fallbackDay = parseScheduleDay(klass.schedulePreference ?? "Sat");
      startDate = nextWeekdayDate(fallbackDay, fallback.hour, fallback.minute);
    }

    const durationMinutes = normalizeDurationMinutes(klass.durationMinutes);
    let windows = buildSegmentWindows(startDate, durationMinutes);
    let shiftAttempts = 0;

    while (await hasTeacherConflictForWindows(teacherId, windows)) {
      if (shiftAttempts >= 8) break;
      startDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      windows = buildSegmentWindows(startDate, durationMinutes);
      shiftAttempts += 1;
    }

    const createdSessions = [];

    for (const window of windows) {
      const meet = await generateMeetLink(klass.name, window.startTime.toISOString(), {
        endIso: window.endTime.toISOString(),
        teacherId,
      });

      const createdSession = await prisma.session.create({
        data: {
          classId: klass.id,
          startTime: window.startTime,
          endTime: window.endTime,
          meetLink: meet.link,
          meetLinkStatus:
            meet.status === "FAILED"
              ? MeetLinkStatus.FAILED
              : meet.status === "PENDING"
                ? MeetLinkStatus.PENDING
                : MeetLinkStatus.GENERATED,
          cancelled: false,
        },
      });

      createdSessions.push(createdSession);
    }

    sessionsCreated += createdSessions.length;

    if (createdSessions.length > 0) {
      const firstSession = createdSessions[0];
      const secondSession = createdSessions[1] ?? null;

      const activeEnrollments = await prisma.enrollment.findMany({
        where: { classId: klass.id, status: EnrollmentStatus.ACTIVE },
        include: { student: true },
      });

      for (const enrollment of activeEnrollments) {
        const content = secondSession
          ? `New session scheduled: ${klass.name} on ${firstSession.startTime.toISOString()}. Segment 1 link: ${firstSession.meetLink ?? "Meet link pending"}. After a ${SEGMENT_BREAK_MINUTES}-minute break, segment 2 starts at ${secondSession.startTime.toISOString()}. Next link: ${secondSession.meetLink ?? "Meet link pending"}.`
          : `New session scheduled: ${klass.name} on ${firstSession.startTime.toISOString()}. Join: ${firstSession.meetLink ?? "Meet link pending"}`;

        const deliveries = await deliverWithFallback(
          { userId: enrollment.student.id, email: enrollment.student.email, phone: enrollment.student.phone, telegramChatId: enrollment.student.telegramChatId, pushSubscription: enrollment.student.pushSubscription },
          content,
        );

        if (deliveries.length > 0) {
          await prisma.notification.createMany({
            data: deliveries.map((delivery) => ({
              userId: enrollment.student.id,
              channel: delivery.channel,
              content,
              status: delivery.status,
              sentAt: new Date(),
            })),
          });
        }
      }
    }
  }

  return { classesChecked: teacherClasses.length, sessionsCreated };
}

export async function runSchedulerBatch() {
  await ensureSeededData();

  const now = new Date();

  const activeClasses = await prisma.class.findMany({
    where: {
      status: ClassStatus.ACTIVE,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  let job = await prisma.schedulerJob.findFirst({
    where: {
      status: SchedulerJobStatus.RUNNING,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!job) {
    job = await prisma.schedulerJob.create({
      data: {
        status: SchedulerJobStatus.RUNNING,
        processedCount: 0,
        totalCount: activeClasses.length,
      },
    });
  }

  const batch = activeClasses.slice(job.processedCount, job.processedCount + 10);

  for (const klass of batch) {
    const hasUpcoming = await prisma.session.findFirst({
      where: {
        classId: klass.id,
        cancelled: false,
        startTime: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
      },
    });

    if (hasUpcoming) {
      continue;
    }

    const availability = await prisma.teacherAvailability.findFirst({
      where: {
        teacherId: klass.teacherId,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTimeUTC: "asc" }],
    });

    let startDate: Date;

    if (availability) {
      const hour = availability.startTimeUTC.getUTCHours();
      const minute = availability.startTimeUTC.getUTCMinutes();
      startDate = nextWeekdayDate(availability.dayOfWeek, hour, minute);
    } else {
      const fallback = parseScheduleTime(klass.schedulePreference ?? "5:00 PM");
      const fallbackDay = parseScheduleDay(klass.schedulePreference ?? "Sat");
      startDate = nextWeekdayDate(fallbackDay, fallback.hour, fallback.minute);
    }

    const durationMinutes = normalizeDurationMinutes(klass.durationMinutes);
    let windows = buildSegmentWindows(startDate, durationMinutes);
    let shiftAttempts = 0;

    while (await hasTeacherConflictForWindows(klass.teacherId, windows)) {
      if (shiftAttempts >= 8) {
        break;
      }

      startDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      windows = buildSegmentWindows(startDate, durationMinutes);
      shiftAttempts += 1;
    }

    const createdSessions = [];

    for (const window of windows) {
      const meet = await generateMeetLink(klass.name, window.startTime.toISOString(), {
        endIso: window.endTime.toISOString(),
        teacherId: klass.teacherId,
      });

      const createdSession = await prisma.session.create({
        data: {
          classId: klass.id,
          startTime: window.startTime,
          endTime: window.endTime,
          meetLink: meet.link,
          meetLinkStatus:
            meet.status === "FAILED"
              ? MeetLinkStatus.FAILED
              : meet.status === "PENDING"
                ? MeetLinkStatus.PENDING
                : MeetLinkStatus.GENERATED,
          cancelled: false,
        },
      });

      createdSessions.push(createdSession);
    }

    if (createdSessions.length === 0) {
      continue;
    }

    const firstSession = createdSessions[0];
    const secondSession = createdSessions[1] ?? null;

    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        classId: klass.id,
        status: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: true,
      },
    });

    for (const enrollment of activeEnrollments) {
      const content = secondSession
        ? `New session scheduled: ${klass.name} on ${firstSession.startTime.toISOString()}. Segment 1 link: ${firstSession.meetLink ?? "Meet link pending"
        }. After a ${SEGMENT_BREAK_MINUTES}-minute break, segment 2 starts at ${secondSession.startTime.toISOString()}. Next link: ${secondSession.meetLink ?? "Meet link pending"
        }.`
        : `New session scheduled: ${klass.name} on ${firstSession.startTime.toISOString()}. Join: ${firstSession.meetLink ?? "Meet link pending"}`;
      const deliveries = await deliverWithFallback(
        {
          userId: enrollment.student.id,
          email: enrollment.student.email,
          phone: enrollment.student.phone,
          telegramChatId: enrollment.student.telegramChatId,
          pushSubscription: enrollment.student.pushSubscription,
        },
        content,
      );

      if (deliveries.length > 0) {
        await prisma.notification.createMany({
          data: deliveries.map((delivery) => ({
            userId: enrollment.student.id,
            channel: delivery.channel,
            content,
            status: delivery.status,
            sentAt: new Date(),
          })),
        });
      }
    }
  }

  const processedCount = job.processedCount + batch.length;
  const complete = processedCount >= job.totalCount;

  const updatedJob = await prisma.schedulerJob.update({
    where: { id: job.id },
    data: {
      processedCount,
      status: complete ? SchedulerJobStatus.COMPLETED : SchedulerJobStatus.RUNNING,
      lastRunAt: new Date(),
    },
  });

  return {
    job: {
      ...updatedJob,
      lastRunAt: updatedJob.lastRunAt?.toISOString() ?? null,
      createdAt: updatedJob.createdAt.toISOString(),
      updatedAt: updatedJob.updatedAt.toISOString(),
    },
    batchProcessed: batch.length,
    completed: complete,
    remaining: Math.max(0, updatedJob.totalCount - updatedJob.processedCount),
  };
}

export async function runReminderBatch() {
  await ensureSeededData();

  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_LEAD_MINUTES - REMINDER_WINDOW_MINUTES / 2) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMINDER_LEAD_MINUTES + REMINDER_WINDOW_MINUTES / 2) * 60 * 1000);

  const sessions = await prisma.session.findMany({
    where: {
      cancelled: false,
      startTime: {
        gte: windowStart,
        lt: windowEnd,
      },
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

  let remindersCreated = 0;
  let deliveriesSent = 0;

  for (const session of sessions) {
    const continuation = await prisma.session.findFirst({
      where: {
        classId: session.classId,
        cancelled: false,
        startTime: {
          gt: session.endTime,
          lte: new Date(session.endTime.getTime() + SEGMENT_TRANSITION_WINDOW_MINUTES * 60 * 1000),
        },
      },
      orderBy: { startTime: "asc" },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: {
        classId: session.classId,
        status: EnrollmentStatus.ACTIVE,
      },
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

    for (const enrollment of enrollments) {
      const dedupeKey = `session_reminder:${session.id}:${enrollment.student.id}`;

      const existing = await prisma.notification.findFirst({
        where: {
          dedupeKey,
          status: { not: NotificationStatus.FAILED },
        },
        select: { id: true },
      });

      if (existing) {
        continue;
      }

      const content = buildSessionReminderContent({
        language: enrollment.student.language,
        timezone: enrollment.student.timezone,
        className: session.class.name,
        teacherName: session.class.teacher.name,
        startTime: session.startTime,
        meetLink: session.meetLink,
        continuation: continuation
          ? {
            startTime: continuation.startTime,
            meetLink: continuation.meetLink,
          }
          : null,
      });

      const deliveries = await deliverWithFallback(
        {
          userId: enrollment.student.id,
          email: enrollment.student.email,
          phone: enrollment.student.phone,
          telegramChatId: enrollment.student.telegramChatId,
          pushSubscription: enrollment.student.pushSubscription,
        },
        content,
      );

      remindersCreated += 1;
      if (deliveries.some((delivery) => delivery.status === "SENT")) {
        deliveriesSent += 1;
      }

      if (deliveries.length > 0) {
        await prisma.notification.createMany({
          data: deliveries.map((delivery) => ({
            userId: enrollment.student.id,
            channel: delivery.channel,
            content,
            status: delivery.status,
            sentAt: new Date(),
            dedupeKey,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Teacher reminder for this session
    try {
      const teacherUser = session.class.teacher;
      const teacherDedupeKey = `session_reminder:${session.id}:teacher:${teacherUser.id}`;

      const existingTeacherReminder = await prisma.notification.findFirst({
        where: {
          dedupeKey: teacherDedupeKey,
          status: { not: NotificationStatus.FAILED },
        },
        select: { id: true },
      });

      if (!existingTeacherReminder) {
        const teacherContent = buildTeacherSessionReminderContent({
          language: teacherUser.language,
          timezone: teacherUser.timezone,
          className: session.class.name,
          startTime: session.startTime,
          meetLink: session.meetLink,
          continuation: continuation
            ? { startTime: continuation.startTime, meetLink: continuation.meetLink }
            : null,
        });

        const teacherDeliveries = await deliverWithFallback(
          { userId: teacherUser.id, email: teacherUser.email, phone: teacherUser.phone, telegramChatId: teacherUser.telegramChatId, pushSubscription: teacherUser.pushSubscription },
          teacherContent,
        );

        remindersCreated += 1;
        if (teacherDeliveries.some((d) => d.status === "SENT")) {
          deliveriesSent += 1;
        }

        if (teacherDeliveries.length > 0) {
          await prisma.notification.createMany({
            data: teacherDeliveries.map((delivery) => ({
              userId: teacherUser.id,
              channel: delivery.channel,
              content: teacherContent,
              status: delivery.status,
              sentAt: new Date(),
              dedupeKey: teacherDedupeKey,
            })),
            skipDuplicates: true,
          });
        }
      }
    } catch (err) {
      console.error("Failed to send teacher reminder:", err);
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

export async function listWebinars() {
  await ensureSeededData();

  const items = await prisma.webinar.findMany({
    orderBy: { startsAt: "asc" },
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

export async function listUserNotifications(userId: string) {
  await ensureSeededData();

  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
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
  const sessions = await prisma.session.findMany({
    where: { classId, cancelled: false },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      startTime: true,
      attendance: {
        select: {
          studentId: true,
          attended: true,
        },
      },
    },
  });

  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: EnrollmentStatus.ACTIVE },
    include: {
      student: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const totalSessions = sessions.length;
  const studentStats = enrollments.map((e) => {
    let present = 0;
    for (const session of sessions) {
      const record = session.attendance.find((a) => a.studentId === e.student.id);
      if (record?.attended) present++;
    }
    return {
      studentId: e.student.id,
      studentName: e.student.name,
      studentEmail: e.student.email,
      sessionsAttended: present,
      totalSessions,
      attendanceRate: totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0,
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

  const classAttendance = await Promise.all(
    enrollments.map(async (e) => {
      const sessions = await prisma.session.findMany({
        where: { classId: e.class.id, cancelled: false },
        select: { id: true },
      });

      const attended = await prisma.attendance.count({
        where: {
          studentId,
          sessionId: { in: sessions.map((s) => s.id) },
          attended: true,
        },
      });

      const totalSessions = sessions.length;

      return {
        classId: e.class.id,
        className: e.class.name,
        totalSessions,
        sessionsAttended: attended,
        attendanceRate: totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0,
      };
    }),
  );

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
