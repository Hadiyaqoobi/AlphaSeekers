import type { UserRole } from "@prisma/client";

import { DEMO_USERS } from "@/lib/constants";
import { generateMeetLink } from "@/lib/integrations/meet";
import { deliverWithFallback } from "@/lib/integrations/notifications";
import { classCatalog } from "@/lib/mock-data";
import { runtime } from "@/lib/runtime";

type Role = UserRole;

type PlatformUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  timezone: string;
  language: "fa" | "en";
  createdAt: string;
  approvedAt: string | null;
  telegramChatId?: string;
  pushSubscription?: string;
  notificationPrefs?: string;
};

type ClassRecord = {
  id: string;
  name: string;
  subjectCategory: string;
  description: string;
  teacherId: string;
  maxStudents: number;
  durationMinutes: number;
  schedulePreference: string;
  language: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

type SessionRecord = {
  id: string;
  classId: string;
  startTime: string;
  endTime: string;
  meetLink: string | null;
  meetLinkStatus: "GENERATED" | "PENDING" | "FAILED";
  cancelled: boolean;
  createdAt: string;
};

type EnrollmentRecord = {
  id: string;
  studentId: string;
  classId: string;
  enrolledAt: string;
  status: "ACTIVE" | "DROPPED";
};

type TeacherAvailabilitySlot = {
  id: string;
  teacherId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type MaterialRecord = {
  id: string;
  classId: string;
  title: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
};

type WebinarRecord = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  meetLink: string;
  language: string;
};

type WebinarRegistration = {
  id: string;
  webinarId: string;
  userId: string;
  registeredAt: string;
};

type OpportunityRecord = {
  id: string;
  title: string;
  type: "SCHOLARSHIP" | "JOB" | "INTERNSHIP" | "GRANT";
  description: string;
  deadline: string;
  externalUrl: string;
  createdAt: string;
};

type LibraryRecord = {
  id: string;
  title: string;
  author: string;
  category: string;
  fileUrl: string;
  fileSize: number;
  externalUrl?: string;
};

type NotificationRecord = {
  id: string;
  userId: string;
  dedupeKey?: string;
  channel: "WHATSAPP" | "TELEGRAM" | "WEB_PUSH" | "EMAIL" | "PLATFORM";
  content: string;
  status: "SENT" | "FAILED" | "PENDING";
  sentAt: string;
};

type AnnouncementRecord = {
  id: string;
  classId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type SchedulerJobRecord = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  processedCount: number;
  totalCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AttendanceRecord = {
  id: string;
  sessionId: string;
  studentId: string;
  attended: boolean;
  joinedAt: string | null;
};

type PlatformStore = {
  users: PlatformUser[];
  classes: ClassRecord[];
  sessions: SessionRecord[];
  enrollments: EnrollmentRecord[];
  teacherAvailability: TeacherAvailabilitySlot[];
  materials: MaterialRecord[];
  webinars: WebinarRecord[];
  webinarRegistrations: WebinarRegistration[];
  opportunities: OpportunityRecord[];
  libraryResources: LibraryRecord[];
  notifications: NotificationRecord[];
  schedulerJobs: SchedulerJobRecord[];
  attendanceRecords: AttendanceRecord[];
  announcements: AnnouncementRecord[];
};

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
  // Accepted for signature parity with the database store. The in-memory demo
  // store does not model scheduling modes, so this is ignored here.
  schedulingMode?: "AUTO" | "MANUAL";
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

type UserSummary = {
  id: string;
  name: string;
  role: Role;
  email: string;
  approvedAt: string | null;
};

type PaginatedResult<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

const MAX_PAGE_SIZE = 10;
const FREE_MEET_SEGMENT_MINUTES = 60;
const SEGMENT_BREAK_MINUTES = 10;
const SEGMENT_TRANSITION_WINDOW_MINUTES = 15;
const REMINDER_LEAD_MINUTES = 60;
const REMINDER_WINDOW_MINUTES = 10;

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

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

function withPagination<T>(rows: T[], page = 1, limit = MAX_PAGE_SIZE): PaginatedResult<T> {
  const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, limit));
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * safeLimit;

  return {
    items: rows.slice(offset, offset + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalItems,
      totalPages,
    },
  };
}

function normalizeSearch(input?: string) {
  return (input ?? "").trim().toLowerCase();
}

function formatDateTimeForUser(date: Date, timezone: string | null | undefined, language: "fa" | "en") {
  const locale = language === "fa" ? "fa-AF" : "en-US";
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
  language: "fa" | "en";
  timezone?: string | null;
  className: string;
  teacherName: string;
  startTime: string;
  meetLink: string | null;
  continuation?: { startTime: string; meetLink: string | null } | null;
}) {
  const when = formatDateTimeForUser(new Date(input.startTime), input.timezone, input.language);
  const joinText = input.meetLink ?? (input.language === "fa" ? "لینک در حال آماده‌سازی است" : "Meet link pending");

  if (input.language === "fa") {
    const base = `یادآوری: صنف ${input.className} یک ساعت بعد شروع می‌شود.\nاستاد: ${input.teacherName}\nزمان: ${when}\nلینک: ${joinText}`;
    if (!input.continuation) {
      return base;
    }

    const nextWhen = formatDateTimeForUser(new Date(input.continuation.startTime), input.timezone, input.language);
    const nextLink = input.continuation.meetLink ?? "لینک در حال آماده‌سازی است";
    return `${base}\nبعد از ${SEGMENT_BREAK_MINUTES} دقیقه استراحت، بخش بعدی در ${nextWhen} شروع می‌شود.\nلینک بعدی: ${nextLink}`;
  }

  const base = `Reminder: ${input.className} starts in 1 hour.\nTeacher: ${input.teacherName}\nTime: ${when}\nJoin: ${joinText}`;
  if (!input.continuation) {
    return base;
  }

  const nextWhen = formatDateTimeForUser(new Date(input.continuation.startTime), input.timezone, input.language);
  const nextLink = input.continuation.meetLink ?? "Meet link pending";
  return `${base}\nAfter a ${SEGMENT_BREAK_MINUTES}-minute break, the next segment starts at ${nextWhen}.\nNext link: ${nextLink}`;
}

function buildTeacherSessionReminderContent(input: {
  language: "fa" | "en";
  timezone?: string | null;
  className: string;
  startTime: string;
  meetLink: string | null;
  continuation?: { startTime: string; meetLink: string | null } | null;
}) {
  const when = formatDateTimeForUser(new Date(input.startTime), input.timezone, input.language);
  const joinText = input.meetLink ?? (input.language === "fa" ? "لینک در حال آماده‌سازی است" : "Meet link pending");

  if (input.language === "fa") {
    const base = `یادآوری استاد: صنف ${input.className} یک ساعت بعد شروع می‌شود.\nزمان: ${when}\nلینک: ${joinText}`;
    if (!input.continuation) return base;
    const nextWhen = formatDateTimeForUser(new Date(input.continuation.startTime), input.timezone, input.language);
    const nextLink = input.continuation.meetLink ?? "لینک در حال آماده‌سازی است";
    return `${base}\nبعد از ${SEGMENT_BREAK_MINUTES} دقیقه استراحت، بخش بعدی در ${nextWhen} شروع می‌شود.\nلینک بعدی: ${nextLink}`;
  }

  const base = `Teacher reminder: Your class "${input.className}" starts in 1 hour.\nTime: ${when}\nJoin: ${joinText}`;
  if (!input.continuation) return base;
  const nextWhen = formatDateTimeForUser(new Date(input.continuation.startTime), input.timezone, input.language);
  const nextLink = input.continuation.meetLink ?? "Meet link pending";
  return `${base}\nAfter a ${SEGMENT_BREAK_MINUTES}-minute break, the next segment starts at ${nextWhen}.\nNext link: ${nextLink}`;
}

function createEmptyStore(): PlatformStore {
  return {
    users: [],
    classes: [],
    sessions: [],
    enrollments: [],
    teacherAvailability: [],
    materials: [],
    webinars: [],
    webinarRegistrations: [],
    opportunities: [],
    libraryResources: [],
    notifications: [],
    schedulerJobs: [],
    attendanceRecords: [],
    announcements: [],
  };
}

function createInitialStore(): PlatformStore {
  // The in-memory store ships with a demo catalog: fake classes, ~120 sample
  // students, sample teachers, and randomly-generated Google Meet links. This
  // mock data must NEVER be presented as real. It is only ever seeded when
  // auto-seeding is enabled (demo/dev). In production (runtime.allowAutoSeed ===
  // false) the memory store starts empty, so even if it is somehow reached it can
  // never serve fabricated classes/students/links as though they were genuine.
  if (!runtime.allowAutoSeed) {
    return createEmptyStore();
  }

  const now = new Date().toISOString();

  const adminUser: PlatformUser = {
    id: DEMO_USERS[0].id,
    name: DEMO_USERS[0].name,
    email: DEMO_USERS[0].email,
    role: "ADMIN",
    timezone: "Asia/Kabul",
    language: "fa",
    phone: "+93700000001",
    createdAt: now,
    approvedAt: now,
  };

  const demoTeacher: PlatformUser = {
    id: DEMO_USERS[1].id,
    name: DEMO_USERS[1].name,
    email: DEMO_USERS[1].email,
    role: "TEACHER",
    timezone: "Asia/Kabul",
    language: "fa",
    phone: "+93700000002",
    createdAt: now,
    approvedAt: now,
  };

  const demoStudent: PlatformUser = {
    id: DEMO_USERS[2].id,
    name: DEMO_USERS[2].name,
    email: DEMO_USERS[2].email,
    role: "STUDENT",
    timezone: "Asia/Kabul",
    language: "fa",
    phone: "+93700000003",
    createdAt: now,
    approvedAt: now,
  };

  const teacherNameSet = new Set(classCatalog.map((item) => item.teacherName));
  teacherNameSet.delete(demoTeacher.name);

  const generatedTeachers: PlatformUser[] = Array.from(teacherNameSet).map((name, index) => ({
    id: `teacher_${index + 1}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, "") || `teacher${index + 1}`}@alphaseekers.org`,
    role: "TEACHER",
    timezone: "Asia/Kabul",
    language: "fa",
    phone: `+93700001${String(index + 1).padStart(2, "0")}`,
    createdAt: now,
    approvedAt: now,
  }));

  const generatedStudents: PlatformUser[] = Array.from({ length: 120 }).map((_, index) => ({
    id: `student_${index + 1}`,
    name: `Student ${index + 1}`,
    email: `student${index + 1}@alphaseekers.org`,
    role: "STUDENT",
    timezone: "Asia/Kabul",
    language: "fa",
    phone: `+937001${String(index + 1).padStart(5, "0")}`,
    createdAt: now,
    approvedAt: now,
  }));

  const users = [adminUser, demoTeacher, demoStudent, ...generatedTeachers, ...generatedStudents];
  const teacherByName = new Map<string, string>([[demoTeacher.name, demoTeacher.id]]);

  generatedTeachers.forEach((teacher) => {
    teacherByName.set(teacher.name, teacher.id);
  });

  const classes: ClassRecord[] = classCatalog.map((item) => ({
    id: item.id,
    name: item.name,
    subjectCategory: item.subjectCategory,
    description: `${item.name} class for Afghan girls.`,
    teacherId: teacherByName.get(item.teacherName) ?? demoTeacher.id,
    maxStudents: 80,
    durationMinutes: FREE_MEET_SEGMENT_MINUTES,
    schedulePreference: item.schedule,
    language: item.language,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  }));

  const sessions: SessionRecord[] = classes.flatMap((item) => {
    const day = parseScheduleDay(item.schedulePreference);
    const time = parseScheduleTime(item.schedulePreference);
    const start = nextWeekdayDate(day, time.hour, time.minute);
    const windows = buildSegmentWindows(start, item.durationMinutes);

    return windows.map((window) => ({
      id: createId("session"),
      classId: item.id,
      startTime: window.startTime.toISOString(),
      endTime: window.endTime.toISOString(),
      meetLink: `https://meet.google.com/${Math.random().toString(36).slice(2, 5)}-${Math.random()
        .toString(36)
        .slice(2, 6)}-${Math.random().toString(36).slice(2, 5)}`,
      meetLinkStatus: "GENERATED" as const,
      cancelled: false,
      createdAt: now,
    }));
  });

  const students = users.filter((item) => item.role === "STUDENT");

  const enrollments: EnrollmentRecord[] = classes.flatMap((item, classIndex) => {
    const targetCount = Math.min(25 + (classIndex % 16), students.length);

    return students.slice(classIndex, classIndex + targetCount).map((student) => ({
      id: createId("enrollment"),
      studentId: student.id,
      classId: item.id,
      enrolledAt: now,
      status: "ACTIVE",
    }));
  });

  const materials: MaterialRecord[] = classes.slice(0, 8).map((item, index) => ({
    id: createId("material"),
    classId: item.id,
    title: `${item.name} - Week ${index + 1} Notes.pdf`,
    fileUrl: `https://example-r2.alphaseekers.org/materials/${item.id}-week-${index + 1}.pdf`,
    fileSize: 350_000 + index * 40_000,
    uploadedBy: item.teacherId,
    createdAt: now,
  }));

  const teacherAvailability: TeacherAvailabilitySlot[] = users
    .filter((item) => item.role === "TEACHER")
    .flatMap((teacher, index) => [
      {
        id: createId("slot"),
        teacherId: teacher.id,
        dayOfWeek: (index + 1) % 7,
        startMinute: 17 * 60,
        endMinute: 19 * 60,
      },
      {
        id: createId("slot"),
        teacherId: teacher.id,
        dayOfWeek: (index + 3) % 7,
        startMinute: 15 * 60,
        endMinute: 17 * 60,
      },
    ]);

  const webinars: WebinarRecord[] = [
    {
      id: createId("webinar"),
      title: "Career Planning for Afghan Girls",
      description: "Drop-in guidance session on scholarship and career pathways.",
      startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      meetLink: "https://meet.google.com/career-webinar-1",
      language: "Dari",
    },
    {
      id: createId("webinar"),
      title: "Mental Health and Study Habits",
      description: "Practical workshop for building healthy learning routines.",
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      meetLink: "https://meet.google.com/wellbeing-webinar-2",
      language: "Dari",
    },
  ];

  const webinarRegistrations: WebinarRegistration[] = [];

  const opportunities: OpportunityRecord[] = [
    {
      id: createId("opportunity"),
      title: "Global Girls Scholarship 2026",
      type: "SCHOLARSHIP",
      description: "Full scholarship for online undergraduate studies.",
      deadline: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
      externalUrl: "https://example.org/scholarship",
      createdAt: now,
    },
    {
      id: createId("opportunity"),
      title: "Remote Internship - Translation Assistant",
      type: "INTERNSHIP",
      description: "Paid remote internship for bilingual students.",
      deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
      externalUrl: "https://example.org/internship",
      createdAt: now,
    },
  ];

  const libraryResources: LibraryRecord[] = [
    {
      id: createId("library"),
      title: "English Grammar Essentials",
      author: "Open Learning Collective",
      category: "Language",
      fileUrl: "https://example-r2.alphaseekers.org/library/english-grammar.pdf",
      fileSize: 1_800_000,
    },
    {
      id: createId("library"),
      title: "Intro to Journalism",
      author: "Community Media Press",
      category: "Professional Skills",
      fileUrl: "https://example-r2.alphaseekers.org/library/journalism-intro.pdf",
      fileSize: 1_350_000,
    },
  ];

  return {
    users,
    classes,
    sessions,
    enrollments,
    teacherAvailability,
    materials,
    webinars,
    webinarRegistrations,
    opportunities,
    libraryResources,
    notifications: [],
    schedulerJobs: [],
    attendanceRecords: [],
    announcements: [],
  };
}

declare global {
  // eslint-disable-next-line no-var
  var alphaseekersStore: PlatformStore | undefined;
}

export function getStore() {
  if (!global.alphaseekersStore) {
    global.alphaseekersStore = createInitialStore();
  }

  return global.alphaseekersStore;
}

function getTeacherName(store: PlatformStore, teacherId: string) {
  return store.users.find((user) => user.id === teacherId)?.name ?? "Unknown Teacher";
}

function getEnrollmentCount(store: PlatformStore, classId: string) {
  return store.enrollments.filter((entry) => entry.classId === classId && entry.status === "ACTIVE").length;
}

function getNextSession(store: PlatformStore, classId: string) {
  const now = Date.now();
  return store.sessions
    .filter((session) => session.classId === classId && !session.cancelled && new Date(session.startTime).getTime() >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
}

export function listClasses(params: ClassListParams = {}) {
  const store = getStore();
  const search = normalizeSearch(params.search);

  const rows = store.classes
    .filter((item) => item.status === "ACTIVE")
    .filter((item) => {
      if (!search) {
        return true;
      }

      return `${item.name} ${item.subjectCategory} ${item.language}`.toLowerCase().includes(search);
    })
    .map((item) => {
      const nextSession = getNextSession(store, item.id);

      return {
        id: item.id,
        name: item.name,
        subjectCategory: item.subjectCategory,
        description: item.description,
        teacherId: item.teacherId,
        teacherName: getTeacherName(store, item.teacherId),
        schedule: item.schedulePreference,
        language: item.language,
        maxStudents: item.maxStudents,
        durationMinutes: normalizeDurationMinutes(item.durationMinutes),
        enrolledCount: getEnrollmentCount(store, item.id),
        nextSessionStart: nextSession?.startTime ?? null,
        meetLink: nextSession?.meetLink ?? null,
      };
    });

  return withPagination(rows, params.page, params.limit);
}

export function getClassById(classId: string) {
  const store = getStore();
  const record = store.classes.find((item) => item.id === classId && item.status === "ACTIVE");

  if (!record) {
    return null;
  }

  const sessions = store.sessions
    .filter((item) => item.classId === classId)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return {
    ...record,
    teacherName: getTeacherName(store, record.teacherId),
    enrolledCount: getEnrollmentCount(store, record.id),
    sessions,
    materials: store.materials.filter((item) => item.classId === classId),
  };
}

function getUserById(userId: string) {
  return getStore().users.find((item) => item.id === userId) ?? null;
}

export function listClassAnnouncements(classId: string) {
  return getStore()
    .announcements.filter((a) => a.classId === classId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createClassAnnouncement(input: { classId: string; authorId: string; authorName: string; content: string }) {
  const store = getStore();
  const record: AnnouncementRecord = {
    id: createId("announcement"),
    ...input,
    createdAt: new Date().toISOString(),
  };
  store.announcements.unshift(record);
  return record;
}

export function listClassEnrollments(classId: string) {
  const store = getStore();
  return store.enrollments
    .filter((e) => e.classId === classId && e.status === "ACTIVE")
    .map((e) => {
      const student = store.users.find((u) => u.id === e.studentId);
      return {
        studentId: e.studentId,
        name: student?.name ?? "Unknown",
        email: student?.email ?? "",
        enrolledAt: e.enrolledAt,
      };
    });
}

export function listUsersByRole(role: Role): UserSummary[] {
  return getStore()
    .users.filter((item) => item.role === role)
    .map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      email: item.email,
      approvedAt: item.approvedAt,
    }));
}

type AdminUserStatusFilter = "PENDING" | "APPROVED" | "ALL";

type AdminUserListParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role | "ALL";
  status?: AdminUserStatusFilter;
};

export function listAdminUsers(params: AdminUserListParams = {}) {
  const store = getStore();
  const search = normalizeSearch(params.search);
  const roleFilter = params.role ?? "ALL";
  const status = params.status ?? "PENDING";

  const rows = store.users
    .filter((user) => (roleFilter === "ALL" ? true : user.role === roleFilter))
    .filter((user) =>
      status === "ALL" ? true : status === "PENDING" ? user.approvedAt === null : user.approvedAt !== null,
    )
    .filter((user) => {
      if (!search) {
        return true;
      }

      const haystack = `${user.name} ${user.email} ${user.phone ?? ""}`.toLowerCase();
      return haystack.includes(search);
    })
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      createdAt: user.createdAt,
      approvedAt: user.approvedAt,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return withPagination(rows, params.page, params.limit);
}

export function setUserApproval(userId: string, approved: boolean) {
  const store = getStore();
  const user = store.users.find((item) => item.id === userId);

  if (!user) {
    return null;
  }

  user.approvedAt = approved ? new Date().toISOString() : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
  };
}

export function listAdminClasses(params: ClassListParams = {}) {
  const store = getStore();
  const search = normalizeSearch(params.search);

  const rows = store.classes
    .filter((item) => `${item.name} ${item.subjectCategory}`.toLowerCase().includes(search))
    .map((item) => ({
      ...item,
      teacherName: getTeacherName(store, item.teacherId),
      enrolledCount: getEnrollmentCount(store, item.id),
    }));

  return withPagination(rows, params.page, params.limit);
}

export function createClass(input: CreateClassInput) {
  const store = getStore();
  const now = new Date().toISOString();

  const entry: ClassRecord = {
    id: createId("class"),
    name: input.name,
    subjectCategory: input.subjectCategory,
    description: input.description,
    teacherId: input.teacherId,
    maxStudents: input.maxStudents,
    durationMinutes: normalizeDurationMinutes(input.durationMinutes),
    schedulePreference: input.schedulePreference,
    language: input.language,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  store.classes.unshift(entry);
  return entry;
}

export async function createClassWithSession(input: CreateClassInput) {
  const store = getStore();
  const now = new Date().toISOString();

  // 1. Create class record
  const entry: ClassRecord = {
    id: createId("class"),
    name: input.name,
    subjectCategory: input.subjectCategory,
    description: input.description,
    teacherId: input.teacherId,
    maxStudents: input.maxStudents,
    durationMinutes: normalizeDurationMinutes(input.durationMinutes),
    schedulePreference: input.schedulePreference,
    language: input.language,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  store.classes.unshift(entry);

  // 2. Calculate session start time
  const availability = store.teacherAvailability.find((item) => item.teacherId === input.teacherId);
  let startDate: Date;

  if (availability) {
    const hour = Math.floor(availability.startMinute / 60);
    const minute = availability.startMinute % 60;
    startDate = nextWeekdayDate(availability.dayOfWeek, hour, minute);
  } else {
    const fallback = parseScheduleTime(input.schedulePreference ?? "5:00 PM");
    const fallbackDay = parseScheduleDay(input.schedulePreference ?? "Sat");
    startDate = nextWeekdayDate(fallbackDay, fallback.hour, fallback.minute);
  }

  // 3. Build session windows + resolve conflicts
  const durationMinutes = normalizeDurationMinutes(input.durationMinutes);
  let windows = buildSegmentWindows(startDate, durationMinutes);
  let shiftAttempts = 0;

  while (hasTeacherConflictForWindows(store, input.teacherId, windows)) {
    if (shiftAttempts >= 8) break;
    startDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    windows = buildSegmentWindows(startDate, durationMinutes);
    shiftAttempts += 1;
  }

  // 4. Create sessions with Meet links
  const createdSessions: SessionRecord[] = [];

  for (const window of windows) {
    const meet = await generateMeetLink(entry.name, window.startTime.toISOString(), {
      endIso: window.endTime.toISOString(),
      teacherId: input.teacherId,
    });

    const session: SessionRecord = {
      id: createId("session"),
      classId: entry.id,
      startTime: window.startTime.toISOString(),
      endTime: window.endTime.toISOString(),
      meetLink: meet.link,
      meetLinkStatus: meet.status === "FAILED" ? "FAILED" : meet.status === "PENDING" ? "PENDING" : "GENERATED",
      cancelled: false,
      createdAt: now,
    };

    store.sessions.push(session);
    createdSessions.push(session);
  }

  // 5. Notify the teacher about the new class assignment
  try {
    const teacher = store.users.find((u) => u.id === input.teacherId);
    if (teacher) {
      const firstSession = createdSessions[0];
      const meetInfo = firstSession?.meetLink ?? (teacher.language === "fa" ? "لینک در حال آماده‌سازی است" : "Meet link pending");
      const teacherContent = teacher.language === "fa"
        ? `صنف جدید "${entry.name}" برای شما ایجاد شده است.\nبرنامه: ${input.schedulePreference}\nلینک: ${meetInfo}\nلطفاً ساعات در دسترس بودن خود را در /teacher/availability تنظیم کنید.`
        : `New class "${entry.name}" has been assigned to you.\nSchedule: ${input.schedulePreference}\nMeet link: ${meetInfo}\nPlease set your availability at /teacher/availability.`;

      const teacherDeliveries = await deliverWithFallback(
        { userId: teacher.id, email: teacher.email, phone: teacher.phone, telegramChatId: teacher.telegramChatId, pushSubscription: teacher.pushSubscription },
        teacherContent,
      );

      teacherDeliveries.forEach((delivery) => {
        store.notifications.push({
          id: createId("notification"),
          userId: teacher.id,
          dedupeKey: `class_assigned:${entry.id}:${teacher.id}`,
          channel: delivery.channel,
          content: teacherContent,
          status: delivery.status,
          sentAt: new Date().toISOString(),
        });
      });
    }
  } catch (err) {
    console.error("Failed to notify teacher about new class:", err);
  }

  return {
    class: entry,
    sessions: createdSessions,
    registrationFormUrl: input.registrationFormUrl ?? null,
  };
}

export function updateClass(classId: string, input: UpdateClassInput) {
  const store = getStore();
  const entry = store.classes.find((item) => item.id === classId);

  if (!entry) {
    return null;
  }

  Object.assign(entry, {
    ...input,
    ...(input.durationMinutes !== undefined
      ? {
        durationMinutes: normalizeDurationMinutes(input.durationMinutes),
      }
      : {}),
    updatedAt: new Date().toISOString(),
  });

  return entry;
}

export function archiveClass(classId: string) {
  const store = getStore();
  const entry = store.classes.find((item) => item.id === classId);

  if (!entry) {
    return null;
  }

  entry.status = "ARCHIVED";
  entry.updatedAt = new Date().toISOString();
  return entry;
}

export async function enrollStudentInClass(studentId: string, classId: string) {
  const store = getStore();
  const student = getUserById(studentId);

  if (!student || student.role !== "STUDENT") {
    throw new Error("Student not found");
  }

  const classRecord = store.classes.find((item) => item.id === classId && item.status === "ACTIVE");

  if (!classRecord) {
    throw new Error("Class not found");
  }

  const existing = store.enrollments.find((item) => item.studentId === studentId && item.classId === classId);

  if (existing && existing.status === "ACTIVE") {
    return {
      enrollment: existing,
      state: "ALREADY_ENROLLED" as const,
    };
  }

  if (getEnrollmentCount(store, classId) >= classRecord.maxStudents) {
    throw new Error("Class is full");
  }

  const enrollment: EnrollmentRecord = {
    id: createId("enrollment"),
    studentId,
    classId,
    enrolledAt: new Date().toISOString(),
    status: "ACTIVE",
  };

  store.enrollments.push(enrollment);

  const upcomingSessions = store.sessions
    .filter((s) => s.classId === classId && !s.cancelled && s.startTime >= new Date().toISOString())
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 8);

  const teacher = store.users.find((u) => u.id === classRecord.teacherId);

  let content = `You are enrolled in ${classRecord.name}!`;

  if (teacher) {
    content += ` Lecturer: ${teacher.name}.`;
  }

  if (classRecord.schedulePreference) {
    content += ` Schedule: ${classRecord.schedulePreference}.`;
  }

  if (upcomingSessions.length > 0) {
    content += ` Upcoming sessions:`;
    upcomingSessions.forEach((session, index) => {
      content += ` (${index + 1}) ${session.startTime} — ${session.meetLink ?? "Meet link pending"}.`;
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

  deliveries.forEach((delivery) => {
    store.notifications.push({
      id: createId("notification"),
      userId: student.id,
      channel: delivery.channel,
      content,
      status: delivery.status,
      sentAt: new Date().toISOString(),
    });
  });

  // Notify teacher about new enrollment
  try {
    if (teacher) {
      const currentCount = getEnrollmentCount(store, classId);
      const teacherContent = teacher.language === "fa"
        ? `شاگرد جدید "${student.name}" در صنف "${classRecord.name}" ثبت‌نام کرد. (${currentCount}/${classRecord.maxStudents})`
        : `New student "${student.name}" enrolled in "${classRecord.name}". (${currentCount}/${classRecord.maxStudents} enrolled)`;

      const teacherDeliveries = await deliverWithFallback(
        { userId: teacher.id, email: teacher.email, phone: teacher.phone, telegramChatId: teacher.telegramChatId, pushSubscription: teacher.pushSubscription },
        teacherContent,
      );

      teacherDeliveries.forEach((delivery) => {
        store.notifications.push({
          id: createId("notification"),
          userId: teacher.id,
          dedupeKey: `enrollment_notify:${enrollment.id}:${teacher.id}`,
          channel: delivery.channel,
          content: teacherContent,
          status: delivery.status,
          sentAt: new Date().toISOString(),
        });
      });
    }
  } catch (err) {
    console.error("Failed to notify teacher about enrollment:", err);
  }

  return {
    enrollment,
    state: "ENROLLED" as const,
    deliveries,
  };
}

export function dropStudentFromClass(studentId: string, classId: string) {
  const store = getStore();
  const entry = store.enrollments.find((item) => item.studentId === studentId && item.classId === classId);

  if (!entry) {
    return null;
  }

  entry.status = "DROPPED";
  return entry;
}

export function isStudentEnrolledInClass(studentId: string, classId: string) {
  const store = getStore();
  return store.enrollments.some(
    (entry) => entry.studentId === studentId && entry.classId === classId && entry.status === "ACTIVE",
  );
}

export function listStudentClasses(studentId: string) {
  const store = getStore();
  const classIds = store.enrollments
    .filter((item) => item.studentId === studentId && item.status === "ACTIVE")
    .map((item) => item.classId);

  return store.classes
    .filter((item) => classIds.includes(item.id) && item.status === "ACTIVE")
    .map((item) => ({
      id: item.id,
      name: item.name,
      teacherName: getTeacherName(store, item.teacherId),
      schedule: item.schedulePreference,
      language: item.language,
      durationMinutes: normalizeDurationMinutes(item.durationMinutes),
      nextSession: getNextSession(store, item.id),
    }));
}

export function getStudentProfileSummary(studentId: string) {
  const store = getStore();
  const student = getUserById(studentId);

  if (!student || student.role !== "STUDENT") {
    return null;
  }

  const classIds = store.enrollments
    .filter((item) => item.studentId === studentId && item.status === "ACTIVE")
    .map((item) => item.classId);

  const now = Date.now();
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  const sessions = store.sessions
    .filter((session) => classIds.includes(session.classId) && !session.cancelled)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const materialCountMap = new Map<string, number>();
  store.materials
    .filter((item) => classIds.includes(item.classId))
    .forEach((item) => {
      materialCountMap.set(item.classId, (materialCountMap.get(item.classId) ?? 0) + 1);
    });

  const sessionsByClass = new Map<string, SessionRecord[]>();
  sessions.forEach((session) => {
    const current = sessionsByClass.get(session.classId);
    if (current) {
      current.push(session);
      return;
    }
    sessionsByClass.set(session.classId, [session]);
  });

  const upcoming = sessions
    .filter((session) => new Date(session.startTime).getTime() >= now)
    .slice(0, 10)
    .map((session) => {
      const classRecord = store.classes.find((item) => item.id === session.classId);

      return {
        id: session.id,
        classId: session.classId,
        className: classRecord?.name ?? "Unknown class",
        startTime: session.startTime,
        endTime: session.endTime,
        meetLink: session.meetLink,
        meetLinkStatus: session.meetLinkStatus,
      };
    });

  const classes = store.classes
    .filter((item) => classIds.includes(item.id) && item.status === "ACTIVE")
    .map((item) => {
      const classSessions = sessionsByClass.get(item.id) ?? [];
      const completedSessions = classSessions.filter((session) => new Date(session.startTime).getTime() < now).length;
      const upcomingSessions = classSessions.filter((session) => new Date(session.startTime).getTime() >= now).length;
      const totalSessions = classSessions.length;
      const nextSession = classSessions.find((session) => new Date(session.startTime).getTime() >= now) ?? null;
      const progressPercent =
        totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0;

      return {
        id: item.id,
        name: item.name,
        teacherName: getTeacherName(store, item.teacherId),
        language: item.language,
        schedule: item.schedulePreference,
        durationMinutes: normalizeDurationMinutes(item.durationMinutes),
        materialCount: materialCountMap.get(item.id) ?? 0,
        completedSessions,
        upcomingSessions,
        totalSessions,
        progressPercent,
        nextSessionStart: nextSession?.startTime ?? null,
        nextSessionMeetLink: nextSession?.meetLink ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const notifications = store.notifications
    .filter((entry) => entry.userId === student.id)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 8);

  const opportunities = listOpportunities()
    .filter((item) => !item.expired)
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      description: item.description,
      deadline: item.deadline,
      externalUrl: item.externalUrl,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
    }));

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      timezone: student.timezone,
      language: student.language.toUpperCase(),
      createdAt: new Date().toISOString(),
    },
    stats: {
      activeClasses: classes.length,
      sessionsThisWeek: upcoming.filter((session) => new Date(session.startTime).getTime() <= weekAhead).length,
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
      sentAt: item.sentAt,
      createdAt: item.sentAt,
    })),
    opportunities,
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

export function listStudentSchedule(studentId: string) {
  const store = getStore();
  const enrolledClassIds = new Set(
    store.enrollments
      .filter((item) => item.studentId === studentId && item.status === "ACTIVE")
      .map((item) => item.classId),
  );

  const schedule = store.sessions
    .filter((item) => enrolledClassIds.has(item.classId) && !item.cancelled)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map((item) => {
      const classRecord = store.classes.find((record) => record.id === item.classId);
      return {
        id: item.id,
        classId: item.classId,
        className: classRecord?.name ?? "Unknown class",
        startTime: item.startTime,
        endTime: item.endTime,
        meetLink: item.meetLink,
        meetLinkStatus: item.meetLinkStatus,
      };
    });

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

export function getJoinNowSession(studentId: string) {
  const now = Date.now();
  const lookback = 15 * 60 * 1000;
  const schedule = listStudentSchedule(studentId);

  return (
    schedule.find((item) => {
      const start = new Date(item.startTime).getTime();
      const end = new Date(item.endTime).getTime();
      return now >= start - lookback && now <= end;
    }) ??
    schedule.find((item) => {
      const start = new Date(item.startTime).getTime();
      return start > now && start <= now + lookback;
    }) ??
    null
  );
}

export function listTeacherAvailability(teacherId: string) {
  return getStore()
    .teacherAvailability.filter((item) => item.teacherId === teacherId)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
}

export function replaceTeacherAvailability(
  teacherId: string,
  slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>,
) {
  const store = getStore();

  store.teacherAvailability = store.teacherAvailability.filter((item) => item.teacherId !== teacherId);

  const normalized = slots
    .filter((slot) => slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6)
    .filter((slot) => slot.startMinute >= 0 && slot.endMinute <= 24 * 60 && slot.endMinute > slot.startMinute)
    .map((slot) => ({
      id: createId("slot"),
      teacherId,
      dayOfWeek: slot.dayOfWeek,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
    }));

  store.teacherAvailability.push(...normalized);
  return normalized;
}

function hasTeacherConflict(store: PlatformStore, teacherId: string, startTime: string, endTime: string) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  const classIds = store.classes.filter((item) => item.teacherId === teacherId).map((item) => item.id);

  return store.sessions.some((session) => {
    if (!classIds.includes(session.classId) || session.cancelled) {
      return false;
    }

    const sessionStart = new Date(session.startTime).getTime();
    const sessionEnd = new Date(session.endTime).getTime();
    return start < sessionEnd && end > sessionStart;
  });
}

function hasTeacherConflictForWindows(
  store: PlatformStore,
  teacherId: string,
  windows: Array<{ startTime: Date; endTime: Date }>,
) {
  return windows.some((window) =>
    hasTeacherConflict(store, teacherId, window.startTime.toISOString(), window.endTime.toISOString()),
  );
}

export async function scheduleTeacherClasses(teacherId: string) {
  const store = getStore();
  const nowTs = Date.now();
  const now = new Date().toISOString();
  const teacherClasses = store.classes.filter(
    (c) => c.teacherId === teacherId && c.status === "ACTIVE",
  );

  let sessionsCreated = 0;

  for (const classRecord of teacherClasses) {
    const hasUpcoming = store.sessions.some((session) => {
      if (session.classId !== classRecord.id || session.cancelled) return false;
      const start = new Date(session.startTime).getTime();
      return start >= nowTs && start <= nowTs + 7 * 24 * 60 * 60 * 1000;
    });

    if (hasUpcoming) continue;

    const availability = store.teacherAvailability
      .filter((slot) => slot.teacherId === teacherId)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)[0];

    let startDate: Date;

    if (availability) {
      const hour = Math.floor(availability.startMinute / 60);
      const minute = availability.startMinute % 60;
      startDate = nextWeekdayDate(availability.dayOfWeek, hour, minute);
    } else {
      const fallback = parseScheduleTime(classRecord.schedulePreference);
      const fallbackDay = parseScheduleDay(classRecord.schedulePreference);
      startDate = nextWeekdayDate(fallbackDay, fallback.hour, fallback.minute);
    }

    const durationMinutes = normalizeDurationMinutes(classRecord.durationMinutes);
    let windows = buildSegmentWindows(startDate, durationMinutes);
    let shiftAttempts = 0;

    while (hasTeacherConflictForWindows(store, teacherId, windows)) {
      if (shiftAttempts >= 8) break;
      startDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      windows = buildSegmentWindows(startDate, durationMinutes);
      shiftAttempts += 1;
    }

    const createdSessions: SessionRecord[] = [];

    for (const window of windows) {
      const meet = await generateMeetLink(classRecord.name, window.startTime.toISOString());

      const session: SessionRecord = {
        id: createId("session"),
        classId: classRecord.id,
        startTime: window.startTime.toISOString(),
        endTime: window.endTime.toISOString(),
        meetLink: meet.link,
        meetLinkStatus: meet.status === "FAILED" ? "FAILED" : meet.status === "PENDING" ? "PENDING" : "GENERATED",
        cancelled: false,
        createdAt: now,
      };

      store.sessions.push(session);
      createdSessions.push(session);
    }

    sessionsCreated += createdSessions.length;

    if (createdSessions.length > 0) {
      const firstSession = createdSessions[0];
      const secondSession = createdSessions[1] ?? null;

      const activeEnrollments = store.enrollments.filter(
        (item) => item.classId === classRecord.id && item.status === "ACTIVE",
      );

      for (const enrollment of activeEnrollments) {
        const student = getUserById(enrollment.studentId);
        if (!student) continue;

        const content = secondSession
          ? `New session scheduled: ${classRecord.name} on ${firstSession.startTime}. Segment 1 link: ${firstSession.meetLink ?? "Meet link pending"}. After a ${SEGMENT_BREAK_MINUTES}-minute break, segment 2 starts at ${secondSession.startTime}. Next link: ${secondSession.meetLink ?? "Meet link pending"}.`
          : `New session scheduled: ${classRecord.name} on ${firstSession.startTime}. Join: ${firstSession.meetLink ?? "Meet link pending"}`;

        const deliveries = await deliverWithFallback(
          { userId: student.id, email: student.email, phone: student.phone, telegramChatId: student.telegramChatId, pushSubscription: student.pushSubscription },
          content,
        );

        deliveries.forEach((delivery) => {
          store.notifications.push({
            id: createId("notification"),
            userId: student.id,
            channel: delivery.channel,
            content,
            status: delivery.status,
            sentAt: new Date().toISOString(),
          });
        });
      }
    }
  }

  return { classesChecked: teacherClasses.length, sessionsCreated };
}

export async function runSchedulerBatch() {
  const store = getStore();
  const now = new Date().toISOString();
  const nowTs = Date.now();
  const activeClasses = store.classes.filter((item) => item.status === "ACTIVE");

  let job = store.schedulerJobs.find((entry) => entry.status === "RUNNING");

  if (!job) {
    job = {
      id: createId("scheduler"),
      status: "RUNNING",
      processedCount: 0,
      totalCount: activeClasses.length,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
    };

    store.schedulerJobs.unshift(job);
  }

  const batch = activeClasses.slice(job.processedCount, job.processedCount + 10);

  for (const classRecord of batch) {
    const hasUpcoming = store.sessions.some((session) => {
      if (session.classId !== classRecord.id || session.cancelled) {
        return false;
      }

      const start = new Date(session.startTime).getTime();
      return start >= nowTs && start <= nowTs + 7 * 24 * 60 * 60 * 1000;
    });

    if (hasUpcoming) {
      continue;
    }

    const availability = store.teacherAvailability
      .filter((slot) => slot.teacherId === classRecord.teacherId)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)[0];

    let startDate: Date;

    if (availability) {
      const hour = Math.floor(availability.startMinute / 60);
      const minute = availability.startMinute % 60;
      startDate = nextWeekdayDate(availability.dayOfWeek, hour, minute);
    } else {
      const fallback = parseScheduleTime(classRecord.schedulePreference);
      const fallbackDay = parseScheduleDay(classRecord.schedulePreference);
      startDate = nextWeekdayDate(fallbackDay, fallback.hour, fallback.minute);
    }

    const durationMinutes = normalizeDurationMinutes(classRecord.durationMinutes);
    let windows = buildSegmentWindows(startDate, durationMinutes);
    let shiftAttempts = 0;

    while (hasTeacherConflictForWindows(store, classRecord.teacherId, windows)) {
      if (shiftAttempts >= 8) {
        break;
      }

      startDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      windows = buildSegmentWindows(startDate, durationMinutes);
      shiftAttempts += 1;
    }

    const createdSessions: SessionRecord[] = [];

    for (const window of windows) {
      const meet = await generateMeetLink(classRecord.name, window.startTime.toISOString());

      const session: SessionRecord = {
        id: createId("session"),
        classId: classRecord.id,
        startTime: window.startTime.toISOString(),
        endTime: window.endTime.toISOString(),
        meetLink: meet.link,
        meetLinkStatus: meet.status,
        cancelled: false,
        createdAt: now,
      };

      store.sessions.push(session);
      createdSessions.push(session);
    }

    if (createdSessions.length === 0) {
      continue;
    }

    const firstSession = createdSessions[0];
    const secondSession = createdSessions[1] ?? null;

    const activeEnrollments = store.enrollments.filter(
      (item) => item.classId === classRecord.id && item.status === "ACTIVE",
    );

    for (const enrollment of activeEnrollments) {
      const student = getUserById(enrollment.studentId);

      if (!student) {
        continue;
      }

      const content = secondSession
        ? `New session scheduled: ${classRecord.name} on ${firstSession.startTime}. Segment 1 link: ${firstSession.meetLink ?? "Meet link pending"
        }. After a ${SEGMENT_BREAK_MINUTES}-minute break, segment 2 starts at ${secondSession.startTime}. Next link: ${secondSession.meetLink ?? "Meet link pending"
        }.`
        : `New session scheduled: ${classRecord.name} on ${firstSession.startTime}. Join: ${firstSession.meetLink ?? "Meet link pending"}`;
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

      deliveries.forEach((delivery) => {
        store.notifications.push({
          id: createId("notification"),
          userId: student.id,
          channel: delivery.channel,
          content,
          status: delivery.status,
          sentAt: new Date().toISOString(),
        });
      });
    }
  }

  job.processedCount += batch.length;
  job.lastRunAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();

  if (job.processedCount >= job.totalCount) {
    job.status = "COMPLETED";
  }

  return {
    job,
    batchProcessed: batch.length,
    completed: job.status === "COMPLETED",
    remaining: Math.max(0, job.totalCount - job.processedCount),
  };
}

export async function runReminderBatch() {
  const store = getStore();
  const now = Date.now();
  const windowStart = now + (REMINDER_LEAD_MINUTES - REMINDER_WINDOW_MINUTES / 2) * 60 * 1000;
  const windowEnd = now + (REMINDER_LEAD_MINUTES + REMINDER_WINDOW_MINUTES / 2) * 60 * 1000;

  const sessions = store.sessions
    .filter((session) => {
      if (session.cancelled) {
        return false;
      }

      const start = new Date(session.startTime).getTime();
      return start >= windowStart && start < windowEnd;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  let remindersCreated = 0;
  let deliveriesSent = 0;

  for (const session of sessions) {
    const classRecord = store.classes.find((record) => record.id === session.classId);
    const teacherName = classRecord ? getTeacherName(store, classRecord.teacherId) : "Unknown";
    const continuation = findContinuationSegment(store.sessions, session);

    const activeEnrollments = store.enrollments.filter(
      (entry) => entry.classId === session.classId && entry.status === "ACTIVE",
    );

    for (const enrollment of activeEnrollments) {
      const student = getUserById(enrollment.studentId);

      if (!student) {
        continue;
      }

      const dedupeKey = `session_reminder:${session.id}:${student.id}`;

      if (store.notifications.some((entry) => entry.dedupeKey === dedupeKey && entry.status !== "FAILED")) {
        continue;
      }

      const content = buildSessionReminderContent({
        language: student.language,
        timezone: student.timezone,
        className: classRecord?.name ?? "Unknown class",
        teacherName,
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
          userId: student.id,
          email: student.email,
          phone: student.phone,
          telegramChatId: student.telegramChatId,
          pushSubscription: student.pushSubscription,
        },
        content,
      );

      remindersCreated += 1;
      if (deliveries.some((delivery) => delivery.status === "SENT")) {
        deliveriesSent += 1;
      }

      deliveries.forEach((delivery) => {
        store.notifications.push({
          id: createId("notification"),
          userId: student.id,
          dedupeKey,
          channel: delivery.channel,
          content,
          status: delivery.status,
          sentAt: new Date().toISOString(),
        });
      });
    }

    // Teacher reminder for this session
    try {
      const teacherUser = classRecord ? store.users.find((u) => u.id === classRecord.teacherId) : null;
      if (teacherUser) {
        const teacherDedupeKey = `session_reminder:${session.id}:teacher:${teacherUser.id}`;
        const existingTeacherReminder = store.notifications.some(
          (n) => n.dedupeKey === teacherDedupeKey && n.status !== "FAILED",
        );

        if (!existingTeacherReminder) {
          const teacherContent = buildTeacherSessionReminderContent({
            language: teacherUser.language,
            timezone: teacherUser.timezone,
            className: classRecord?.name ?? "Unknown class",
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

          teacherDeliveries.forEach((delivery) => {
            store.notifications.push({
              id: createId("notification"),
              userId: teacherUser.id,
              dedupeKey: teacherDedupeKey,
              channel: delivery.channel,
              content: teacherContent,
              status: delivery.status,
              sentAt: new Date().toISOString(),
            });
          });
        }
      }
    } catch (err) {
      console.error("Failed to send teacher session reminder:", err);
    }
  }

  return {
    windowStart: new Date(windowStart).toISOString(),
    windowEnd: new Date(windowEnd).toISOString(),
    sessionsFound: sessions.length,
    remindersCreated,
    deliveriesSent,
  };
}

export function listTodaySessions() {
  const store = getStore();
  const now = new Date();

  return store.sessions
    .filter((session) => {
      const date = new Date(session.startTime);
      return (
        date.getUTCFullYear() === now.getUTCFullYear() &&
        date.getUTCMonth() === now.getUTCMonth() &&
        date.getUTCDate() === now.getUTCDate()
      );
    })
    .map((session) => {
      const classRecord = store.classes.find((entry) => entry.id === session.classId);
      const studentCount = store.enrollments.filter(
        (entry) => entry.classId === session.classId && entry.status === "ACTIVE",
      ).length;

      return {
        id: session.id,
        className: classRecord?.name ?? "Unknown class",
        teacherName: classRecord ? getTeacherName(store, classRecord.teacherId) : "Unknown",
        studentCount,
        meetLinkStatus: session.meetLinkStatus,
        startTime: session.startTime,
      };
    });
}

export function getDashboardStats() {
  const store = getStore();

  return {
    activeClasses: store.classes.filter((entry) => entry.status === "ACTIVE").length,
    students: store.users.filter((entry) => entry.role === "STUDENT").length,
    teachers: store.users.filter((entry) => entry.role === "TEACHER").length,
    sessionsToday: listTodaySessions().length,
  };
}

export function listWebinars() {
  return getStore().webinars.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function createWebinar(input: CreateWebinarInput) {
  const store = getStore();
  const entry: WebinarRecord = {
    id: createId("webinar"),
    ...input,
  };

  store.webinars.push(entry);
  return entry;
}

export function listRegisteredWebinarIds(userId: string) {
  const store = getStore();
  return store.webinarRegistrations.filter((entry) => entry.userId === userId).map((entry) => entry.webinarId);
}

export async function registerForWebinar(webinarId: string, userId: string) {
  const store = getStore();
  const webinar = store.webinars.find((entry) => entry.id === webinarId);
  const user = getUserById(userId);

  if (!webinar) {
    throw new Error("Webinar not found");
  }

  if (!user) {
    throw new Error("User not found");
  }

  const existing = store.webinarRegistrations.find((entry) => entry.webinarId === webinarId && entry.userId === userId);

  if (existing) {
    return existing;
  }

  const registration: WebinarRegistration = {
    id: createId("webinar_reg"),
    webinarId,
    userId,
    registeredAt: new Date().toISOString(),
  };

  store.webinarRegistrations.push(registration);

  const content = `Webinar registration confirmed: ${webinar.title} at ${webinar.startsAt}. Join: ${webinar.meetLink}`;
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

  deliveries.forEach((delivery) => {
    store.notifications.push({
      id: createId("notification"),
      userId: user.id,
      channel: delivery.channel,
      content,
      status: delivery.status,
      sentAt: new Date().toISOString(),
    });
  });

  return registration;
}

export function listOpportunities(type?: string) {
  const now = Date.now();

  return getStore()
    .opportunities.filter((entry) => (!type ? true : entry.type === type))
    .map((entry) => ({
      ...entry,
      expired: new Date(entry.deadline).getTime() < now,
    }))
    .sort((a, b) => {
      if (a.expired !== b.expired) {
        return a.expired ? 1 : -1;
      }

      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
}

export function createOpportunity(input: CreateOpportunityInput) {
  const store = getStore();

  const entry: OpportunityRecord = {
    id: createId("opportunity"),
    ...input,
    createdAt: new Date().toISOString(),
  };

  store.opportunities.unshift(entry);
  return entry;
}

export function listLibraryResources(query?: string) {
  const search = normalizeSearch(query);

  return getStore().libraryResources.filter((entry) => {
    if (!search) {
      return true;
    }

    return `${entry.title} ${entry.author} ${entry.category}`.toLowerCase().includes(search);
  });
}

export function createLibraryResource(input: CreateLibraryInput) {
  const store = getStore();

  const entry: LibraryRecord = {
    id: createId("library"),
    ...input,
  };

  store.libraryResources.unshift(entry);
  return entry;
}

export function listClassMaterials(classId: string) {
  return getStore().materials.filter((entry) => entry.classId === classId);
}

export function createClassMaterial(input: CreateMaterialInput) {
  const store = getStore();

  const entry: MaterialRecord = {
    id: createId("material"),
    ...input,
    createdAt: new Date().toISOString(),
  };

  store.materials.unshift(entry);
  return entry;
}

export function listUserNotifications(userId: string) {
  return getStore()
    .notifications.filter((entry) => entry.userId === userId)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export function getUser(userId: string) {
  return getUserById(userId);
}

// ─── Attendance Tracking (BRD US-13) ─────────────────────────────────

export function getSessionAttendance(sessionId: string) {
  const store = getStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const klass = store.classes.find((c) => c.id === session.classId);
  const enrollments = store.enrollments.filter(
    (e) => e.classId === session.classId && e.status === "ACTIVE",
  );

  const students = enrollments.map((e) => {
    const user = store.users.find((u) => u.id === e.studentId);
    const record = store.attendanceRecords.find(
      (a) => a.sessionId === sessionId && a.studentId === e.studentId,
    );
    return {
      studentId: e.studentId,
      studentName: user?.name ?? "Unknown",
      studentEmail: user?.email ?? "",
      attended: record?.attended ?? false,
      joinedAt: record?.joinedAt ?? null,
      checkinVerified: (record as AttendanceRecord & { checkinVerified?: boolean })?.checkinVerified ?? false,
      checkinAt: (record as AttendanceRecord & { checkinAt?: string | null })?.checkinAt ?? null,
    };
  });

  return {
    sessionId: session.id,
    classId: session.classId,
    className: klass?.name ?? "Unknown",
    startTime: session.startTime,
    endTime: session.endTime,
    students,
  };
}

export function markAttendance(
  sessionId: string,
  studentId: string,
  attended: boolean,
) {
  const store = getStore();
  const existing = store.attendanceRecords.find(
    (a) => a.sessionId === sessionId && a.studentId === studentId,
  );

  if (existing) {
    existing.attended = attended;
    existing.joinedAt = attended ? new Date().toISOString() : null;
    return existing;
  }

  const record: AttendanceRecord = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId,
    studentId,
    attended,
    joinedAt: attended ? new Date().toISOString() : null,
  };
  store.attendanceRecords.push(record);
  return record;
}

export function getClassAttendanceSummary(classId: string) {
  const store = getStore();
  const sessions = store.sessions.filter(
    (s) => s.classId === classId && !s.cancelled,
  );
  const enrollments = store.enrollments.filter(
    (e) => e.classId === classId && e.status === "ACTIVE",
  );
  const totalSessions = sessions.length;

  const students = enrollments.map((e) => {
    const user = store.users.find((u) => u.id === e.studentId);
    let present = 0;
    let verified = 0;
    for (const session of sessions) {
      const record = store.attendanceRecords.find(
        (a) => a.sessionId === session.id && a.studentId === e.studentId,
      );
      if (record?.attended) present++;
      if ((record as (AttendanceRecord & { checkinVerified?: boolean }) | undefined)?.checkinVerified) {
        verified++;
      }
    }
    return {
      studentId: e.studentId,
      studentName: user?.name ?? "Unknown",
      studentEmail: user?.email ?? "",
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
    students,
  };
}

/**
 * List classes assigned to a teacher with recent sessions and enrollment counts.
 */
export function listTeacherClasses(teacherId: string) {
  const store = getStore();
  const classes = store.classes.filter(
    (c) => c.teacherId === teacherId && c.status === "ACTIVE",
  );

  return classes
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      const enrolledCount = store.enrollments.filter(
        (e) => e.classId === c.id && e.status === "ACTIVE",
      ).length;

      const sessions = store.sessions
        .filter((s) => s.classId === c.id)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          startTime: s.startTime,
          meetLinkStatus: s.meetLinkStatus,
        }));

      return {
        id: c.id,
        name: c.name,
        subjectCategory: c.subjectCategory,
        schedule: c.schedulePreference,
        durationMinutes: c.durationMinutes,
        enrolledCount,
        sessions,
      };
    });
}

/**
 * Get student attendance history across all enrolled classes.
 */
export function getStudentAttendanceHistory(studentId: string) {
  const store = getStore();
  const enrollments = store.enrollments.filter(
    (e) => e.studentId === studentId && e.status === "ACTIVE",
  );

  const classAttendance = enrollments.map((e) => {
    const klass = store.classes.find((c) => c.id === e.classId);
    const sessions = store.sessions.filter(
      (s) => s.classId === e.classId && !s.cancelled,
    );
    const totalSessions = sessions.length;

    let attended = 0;
    for (const session of sessions) {
      const record = store.attendanceRecords.find(
        (a) => a.sessionId === session.id && a.studentId === studentId,
      );
      if (record?.attended) attended++;
    }

    return {
      classId: e.classId,
      className: klass?.name ?? "Unknown",
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
export function getAdminAnalytics() {
  const store = getStore();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const totalUsers = store.users.length;

  const byRole: Record<string, number> = {};
  for (const user of store.users) {
    byRole[user.role] = (byRole[user.role] ?? 0) + 1;
  }

  const approvedCount = store.users.filter((u) => u.approvedAt !== null).length;
  const pendingCount = totalUsers - approvedCount;
  const byStatus: Record<string, number> = {
    APPROVED: approvedCount,
    PENDING: pendingCount,
  };

  const recentSignups = store.users.filter(
    (u) => new Date(u.createdAt) >= sevenDaysAgo,
  ).length;

  const totalClasses = store.classes.length;
  const activeClasses = store.classes.filter((c) => c.status === "ACTIVE").length;
  const totalEnrollments = store.enrollments.filter((e) => e.status === "ACTIVE").length;

  const totalAttendanceRecords = store.attendanceRecords.length;
  const attendedCount = store.attendanceRecords.filter((a) => a.attended).length;
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
