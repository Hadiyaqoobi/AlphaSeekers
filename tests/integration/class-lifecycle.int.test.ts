/**
 * The class lifecycle against a REAL Postgres: auto-scheduling rule, sticky
 * cancellations, archive/restore, Meet-link ids + retry, reminders.
 *
 * Google is replaced by a mock so the event ids the code must persist are real
 * values (with mock links off, as in production, nothing would be stored).
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const meet = vi.hoisted(() => ({ generate: vi.fn(), cancel: vi.fn(), update: vi.fn(), counter: { n: 0 } }));
vi.mock("@/lib/integrations/meet", () => ({
  generateMeetLink: meet.generate,
  cancelMeetEvent: meet.cancel,
  updateMeetEvent: meet.update,
}));

import { prisma } from "@/lib/prisma";
import { collectClassIssues } from "@/lib/platform/class-health";
import {
  archiveClass,
  createClass,
  createClassWithSession,
  getClassAttendanceSummary,
  listStudentSchedule,
  restoreClass,
  runReminderBatch,
  runSchedulerBatch,
  scheduleTeacherClasses,
  setSessionMeetLink,
} from "@/lib/platform/db-store";
import { getTeacherSetupStatus } from "@/lib/platform/teacher-setup";
import { createManualSession } from "@/lib/scheduling/sessions";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "clslife";
const email = (s: string) => `${TAG}+${s}@example.com`;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const KABUL = (4 * 60 + 30) * MIN;

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { OR: [{ studentId: { in: ids } }, { class: { teacherId: { in: ids } } }] } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.teacherAvailability.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.job.deleteMany({});
}

async function makeTeacher(slug: string, windows: Array<[day: number, start: string, end: string]> = []) {
  const teacher = await prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "TEACHER", approvedAt: new Date() },
    select: { id: true },
  });
  for (const [dayOfWeek, start, end] of windows) {
    await prisma.teacherAvailability.create({
      data: {
        teacherId: teacher.id,
        dayOfWeek,
        startTimeUTC: new Date(`1970-01-01T${start}:00Z`),
        endTimeUTC: new Date(`1970-01-01T${end}:00Z`),
      },
    });
  }
  return teacher;
}

async function makeClass(teacherId: string, over: Record<string, unknown> = {}) {
  return prisma.class.create({
    data: {
      name: `${TAG} class`,
      subjectCategory: "English",
      description: "fixture",
      teacherId,
      maxStudents: 20,
      durationMinutes: 60,
      schedulePreference: "Wed 2:00 PM",
      schedulingMode: "AUTO",
      ...over,
    },
  });
}

async function makeStudent(slug: string, classId: string) {
  const student = await prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "STUDENT", approvedAt: new Date() },
  });
  await prisma.enrollment.create({ data: { studentId: student.id, classId, status: "ACTIVE" } });
  return student;
}

const kabulParts = (date: Date) => {
  const local = new Date(date.getTime() + KABUL);
  return { day: local.getUTCDay(), hour: local.getUTCHours(), minute: local.getUTCMinutes() };
};

d("class lifecycle (real Postgres)", () => {
  beforeEach(async () => {
    await cleanup();
    meet.counter.n = 0;
    meet.generate.mockReset().mockImplementation(async () => {
      meet.counter.n += 1;
      return {
        link: `https://meet.google.com/tst-${meet.counter.n}`,
        status: "GENERATED",
        eventId: `evt-${meet.counter.n}`,
        calendarId: "owner@example.com",
      };
    });
    meet.cancel.mockReset().mockResolvedValue({ ok: true });
  });
  afterAll(cleanup);

  // ── C9 / C8: the scheduling rule ──────────────────────────────────────────
  it("books the POSTED day/time inside availability and stores the calendar event ids (C9, C4)", async () => {
    const teacher = await makeTeacher("fits", [[3, "13:00", "17:00"]]);
    const klass = await makeClass(teacher.id);

    await scheduleTeacherClasses(teacher.id);

    const sessions = await prisma.session.findMany({ where: { classId: klass.id } });
    expect(sessions).toHaveLength(1);
    expect(kabulParts(sessions[0].startTime)).toEqual({ day: 3, hour: 14, minute: 0 });
    expect(sessions[0].startTime.getTime()).toBeGreaterThan(Date.now());
    expect(sessions[0].meetLinkStatus).toBe("GENERATED");
    expect(sessions[0].googleEventId).toMatch(/^evt-/);
    expect(sessions[0].googleCalendarId).toBe("owner@example.com");
  });

  it("books the time staff posted even outside the teacher's saved hours, never moving it (C9)", async () => {
    const teacher = await makeTeacher("outside", [[3, "13:00", "17:00"]]);
    const otherDay = await makeClass(teacher.id, { schedulePreference: "Thu 2:00 PM" });
    const unreadable = await makeClass(teacher.id, { schedulePreference: "evenings" });

    await scheduleTeacherClasses(teacher.id);

    // Staff set the date: Thursday is booked although the teacher saved only Wednesday.
    const booked = await prisma.session.findMany({ where: { classId: otherDay.id } });
    expect(booked).toHaveLength(1);
    expect(kabulParts(booked[0].startTime)).toEqual({ day: 4, hour: 14, minute: 0 });
    expect(await prisma.session.count({ where: { classId: unreadable.id } })).toBe(0);

    // An unreadable time is surfaced, not silent.
    const issues = await collectClassIssues();
    expect(issues.some((i) => i.classId === unreadable.id && i.kind === "schedule-unreadable")).toBe(true);
    const setup = await getTeacherSetupStatus(teacher.id);
    expect(setup.classes.find((c) => c.id === otherDay.id)?.scheduleProblem).toBeNull();
    expect(setup.classes.find((c) => c.id === unreadable.id)?.scheduleProblem).toBe("unparseable");
  });

  it("never books an overlap: a second class at the same time is not booked (C9)", async () => {
    const teacher = await makeTeacher("overlap", [[3, "13:00", "17:00"]]);
    await makeClass(teacher.id, { name: `${TAG} first` });
    await makeClass(teacher.id, { name: `${TAG} second` });

    await scheduleTeacherClasses(teacher.id);
    await scheduleTeacherClasses(teacher.id);

    expect(await prisma.session.count({ where: { class: { teacherId: teacher.id } } })).toBe(1);
  });

  it("books the posted time once when the teacher saved no availability (decision 2026-10-14)", async () => {
    const teacher = await makeTeacher("none");
    const klass = await makeClass(teacher.id);

    await scheduleTeacherClasses(teacher.id);
    await scheduleTeacherClasses(teacher.id);

    expect(await prisma.session.count({ where: { classId: klass.id } })).toBe(1);
  });

  it("concurrent post-availability and scheduler runs cannot double-book (C8 lock)", async () => {
    const teacher = await makeTeacher("race", [[3, "13:00", "17:00"]]);
    const klass = await makeClass(teacher.id);

    await Promise.all([
      scheduleTeacherClasses(teacher.id),
      scheduleTeacherClasses(teacher.id),
      scheduleTeacherClasses(teacher.id),
    ]);

    expect(await prisma.session.count({ where: { classId: klass.id } })).toBe(1);
  });

  // ── C1: cancellations and reschedules stick ───────────────────────────────
  it("a cancelled session is NOT recreated by the next scheduler run (C1)", async () => {
    const teacher = await makeTeacher("cancel", [[3, "13:00", "17:00"]]);
    const klass = await makeClass(teacher.id);
    await scheduleTeacherClasses(teacher.id);
    await prisma.session.updateMany({ where: { classId: klass.id }, data: { cancelled: true } });

    await scheduleTeacherClasses(teacher.id);
    await scheduleTeacherClasses(teacher.id);

    const rows = await prisma.session.findMany({ where: { classId: klass.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].cancelled).toBe(true);
  });

  it("a session moved more than a week out does not make a new one appear this week (C1)", async () => {
    const teacher = await makeTeacher("moved", [[3, "13:00", "17:00"]]);
    const klass = await makeClass(teacher.id);
    await scheduleTeacherClasses(teacher.id);
    const booked = await prisma.session.findFirstOrThrow({ where: { classId: klass.id } });

    // What rescheduleSession does: new time, confirmedAt stamped after creation.
    await prisma.session.update({
      where: { id: booked.id },
      data: {
        startTime: new Date(booked.startTime.getTime() + 10 * DAY),
        endTime: new Date(booked.endTime.getTime() + 10 * DAY),
        createdAt: new Date(Date.now() - 30 * MIN),
        confirmedAt: new Date(),
      },
    });

    await scheduleTeacherClasses(teacher.id);

    expect(await prisma.session.count({ where: { classId: klass.id } })).toBe(1);
  });

  it("an EXTRA session added by hand far ahead does not stop the weekly class (C1)", async () => {
    const teacher = await makeTeacher("extra", [[3, "13:00", "17:00"]]);
    const klass = await makeClass(teacher.id);
    const farExtra = await createManualSession({ classId: klass.id, startTime: new Date(Date.now() + 20 * DAY) });
    expect(farExtra.ok).toBe(true);

    await scheduleTeacherClasses(teacher.id);
    expect(await prisma.session.count({ where: { classId: klass.id } })).toBe(2);

    // An extra added in the SAME week (a day before the weekly slot) does not
    // stop the weekly class either.
    const weekly = await prisma.session.findFirstOrThrow({ where: { classId: klass.id, confirmedAt: null } });
    // Needs room for a 30-minute extra before the slot (not the case in the hour
    // or two before Wednesday 14:00 Kabul).
    if (weekly.startTime.getTime() - Date.now() < 3 * 60 * MIN) return;
    await prisma.session.delete({ where: { id: weekly.id } });
    const nearExtraStart = new Date(Math.max(weekly.startTime.getTime() - DAY, Date.now() + 60 * MIN));
    expect((await createManualSession({ classId: klass.id, startTime: nearExtraStart, durationMinutes: 30 })).ok).toBe(true);
    await scheduleTeacherClasses(teacher.id);
    expect(await prisma.session.count({ where: { classId: klass.id, startTime: weekly.startTime } })).toBe(1);
  });

  // ── C2: archive stops a class; restore brings it back ─────────────────────
  it("archiving cancels future sessions + their calendar events, hides them, and blocks new ones (C2)", async () => {
    const teacher = await makeTeacher("archive", [[3, "13:00", "17:00"]]);
    const klass = await makeClass(teacher.id);
    const student = await makeStudent("archive-student", klass.id);
    await scheduleTeacherClasses(teacher.id);
    const past = await prisma.session.create({
      data: { classId: klass.id, startTime: new Date(Date.now() - 2 * DAY), endTime: new Date(Date.now() - 2 * DAY + 60 * MIN) },
    });
    expect((await listStudentSchedule(student.id)).some((s) => s.classId === klass.id)).toBe(true);

    await archiveClass(klass.id);

    const future = await prisma.session.findMany({ where: { classId: klass.id, startTime: { gte: new Date() } } });
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((s) => s.cancelled)).toBe(true);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: past.id } })).cancelled).toBe(false);
    expect(meet.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: future[0].googleEventId, calendarId: "owner@example.com" }),
    );
    expect((await listStudentSchedule(student.id)).some((s) => s.classId === klass.id)).toBe(false);

    const refused = await createManualSession({ classId: klass.id, startTime: new Date(Date.now() + 3 * DAY) });
    expect(refused.ok).toBe(false);

    // The auto-scheduler skips it too.
    await scheduleTeacherClasses(teacher.id);
    expect(await prisma.session.count({ where: { classId: klass.id, cancelled: false, startTime: { gte: new Date() } } })).toBe(0);

    await restoreClass(klass.id);
    expect((await prisma.class.findUniqueOrThrow({ where: { id: klass.id } })).status).toBe("ACTIVE");
    expect((await createManualSession({ classId: klass.id, startTime: new Date(Date.now() + 3 * DAY) })).ok).toBe(true);
  });

  it("no reminders for an archived class (C2)", async () => {
    const teacher = await makeTeacher("arch-remind");
    const klass = await makeClass(teacher.id, { status: "ARCHIVED" });
    await makeStudent("arch-remind-student", klass.id);
    const session = await prisma.session.create({
      data: {
        classId: klass.id,
        startTime: new Date(Date.now() + 60 * MIN),
        endTime: new Date(Date.now() + 120 * MIN),
        meetLink: "https://meet.google.com/x",
        meetLinkStatus: "GENERATED",
      },
    });

    await runReminderBatch();

    expect(await prisma.notification.count({ where: { dedupeKey: { startsWith: `session_reminder:${session.id}:` } } })).toBe(0);
  });

  // ── C17 / C14: reminders ─────────────────────────────────────────────────
  it("segment 2 of a long class gets no mid-class reminder; a moved session gets a fresh one (C17, C14)", async () => {
    const teacher = await makeTeacher("segments");
    const longClass = await makeClass(teacher.id, { name: `${TAG} long`, durationMinutes: 120 });
    const plainClass = await makeClass(teacher.id, { name: `${TAG} plain` });
    const student = await makeStudent("segments-student", longClass.id);
    // English, so the (English-only) start-time wording can be asserted.
    await prisma.user.update({ where: { id: student.id }, data: { language: "EN" } });
    await prisma.enrollment.create({ data: { studentId: student.id, classId: plainClass.id, status: "ACTIVE" } });
    const now = Date.now();
    await prisma.session.create({
      data: { classId: longClass.id, startTime: new Date(now - 40 * MIN), endTime: new Date(now + 20 * MIN), meetLink: "https://meet.google.com/a", meetLinkStatus: "GENERATED" },
    });
    const segment2 = await prisma.session.create({
      data: { classId: longClass.id, startTime: new Date(now + 30 * MIN), endTime: new Date(now + 90 * MIN), meetLink: "https://meet.google.com/b", meetLinkStatus: "GENERATED" },
    });
    const plain = await prisma.session.create({
      data: { classId: plainClass.id, startTime: new Date(now + 60 * MIN), endTime: new Date(now + 120 * MIN), meetLink: "https://meet.google.com/c", meetLinkStatus: "GENERATED" },
    });

    await runReminderBatch();

    const reminders = (prefixId: string) =>
      prisma.notification.findMany({ where: { userId: student.id, dedupeKey: { startsWith: `session_reminder:${prefixId}:` } } });
    expect(await reminders(segment2.id)).toHaveLength(0);
    const first = await reminders(plain.id);
    expect(first).toHaveLength(1);
    expect(first[0].content).toContain("starts at");
    expect(first[0].content).not.toContain("starts in 1 hour");

    // Same pulse again: deduped. After a reschedule: a new reminder for the new time.
    await runReminderBatch();
    expect(await reminders(plain.id)).toHaveLength(1);
    await prisma.session.update({
      where: { id: plain.id },
      data: { startTime: new Date(now + 70 * MIN), endTime: new Date(now + 130 * MIN) },
    });
    await runReminderBatch();
    expect(await reminders(plain.id)).toHaveLength(2);
  });

  // ── C4: missing links are retried; staff can set one by hand ──────────────
  it("the scheduler retries PENDING/FAILED Meet links in the next 7 days and stores the event ids (C4)", async () => {
    const teacher = await makeTeacher("retry");
    const klass = await makeClass(teacher.id, { schedulingMode: "MANUAL" });
    const pending = await prisma.session.create({
      data: { classId: klass.id, startTime: new Date(Date.now() + 2 * DAY), endTime: new Date(Date.now() + 2 * DAY + 60 * MIN), meetLinkStatus: "PENDING" },
    });
    const manual = await prisma.session.create({
      data: { classId: klass.id, startTime: new Date(Date.now() + 3 * DAY), endTime: new Date(Date.now() + 3 * DAY + 60 * MIN), meetLinkStatus: "FAILED" },
    });
    expect(await setSessionMeetLink(klass.id, manual.id, "https://meet.google.com/by-hand")).toBe(true);
    // Scoped by class: a session id from another class matches nothing.
    expect(await setSessionMeetLink("not-this-class", manual.id, "https://evil.example")).toBe(false);

    await runSchedulerBatch();

    const repaired = await prisma.session.findUniqueOrThrow({ where: { id: pending.id } });
    expect(repaired.meetLinkStatus).toBe("GENERATED");
    expect(repaired.meetLink).toMatch(/^https:\/\/meet\.google\.com\/tst-/);
    expect(repaired.googleEventId).toMatch(/^evt-/);
    expect(repaired.googleCalendarId).toBe("owner@example.com");
    // The hand-set link is left alone.
    expect((await prisma.session.findUniqueOrThrow({ where: { id: manual.id } })).meetLink).toBe("https://meet.google.com/by-hand");
  });

  // ── C13 / C15 / C16 / C6 ─────────────────────────────────────────────────
  it("attendance counts only sessions that have started (C13)", async () => {
    const teacher = await makeTeacher("attendance");
    const klass = await makeClass(teacher.id, { schedulingMode: "MANUAL" });
    await prisma.session.createMany({
      data: [
        { classId: klass.id, startTime: new Date(Date.now() - DAY), endTime: new Date(Date.now() - DAY + 60 * MIN) },
        { classId: klass.id, startTime: new Date(Date.now() + DAY), endTime: new Date(Date.now() + DAY + 60 * MIN) },
      ],
    });
    expect((await getClassAttendanceSummary(klass.id)).totalSessions).toBe(1);
  });

  it("a healthy AUTO class with its one upcoming session raises no low-sessions alarm (C15)", async () => {
    const teacher = await makeTeacher("health", [[3, "13:00", "17:00"]]);
    const klass = await makeClass(teacher.id);
    await scheduleTeacherClasses(teacher.id);

    const issues = (await collectClassIssues()).filter((i) => i.classId === klass.id);
    expect(issues).toEqual([]);
  });

  it("setup counts only ACTIVE students and treats MANUAL classes as teacher-scheduled (C16, C6)", async () => {
    const teacher = await makeTeacher("setup");
    const klass = await makeClass(teacher.id, { schedulingMode: "MANUAL" });
    await makeStudent("setup-active", klass.id);
    const pendingStudent = await prisma.user.create({
      data: { name: `${TAG} pending`, email: email("setup-pending"), role: "STUDENT" },
    });
    await prisma.enrollment.create({ data: { studentId: pendingStudent.id, classId: klass.id, status: "PENDING" } });

    const status = await getTeacherSetupStatus(teacher.id);
    expect(status.classes[0].enrolledCount).toBe(1);
    expect(status.classes[0].schedulingMode).toBe("MANUAL");
    expect(status.complete).toBe(true);
  });

  it("a MANUAL class's teacher is told to add dates, not that sessions are automatic (C6)", async () => {
    const teacher = await makeTeacher("manual-notify");
    const klass = await createClass({
      name: `${TAG} manual`,
      subjectCategory: "English",
      description: "fixture",
      teacherId: teacher.id,
      maxStudents: 10,
      durationMinutes: 60,
      schedulePreference: "Tue 6:00 PM",
      language: "English",
      schedulingMode: "MANUAL",
    });
    const note = await prisma.notification.findFirstOrThrow({ where: { userId: teacher.id } });
    expect(note.content).toContain(`/teacher/classes/${klass.id}/schedule`);
    expect(note.content).not.toMatch(/sessions are (then )?created automatically/i);
  });

  // ── class creation books immediately with the same rule ──────────────────
  it("posting a class books its first session (with Meet link) at once, or says why not", async () => {
    const fits = await makeTeacher("create-fits", [[2, "17:00", "20:00"]]);
    const created = await createClassWithSession({
      name: `${TAG} created`,
      subjectCategory: "English",
      description: "fixture",
      teacherId: fits.id,
      maxStudents: 10,
      durationMinutes: 60,
      schedulePreference: "Tue 6:00 PM",
      language: "English",
    });
    expect(created.scheduleIssue).toBeNull();
    expect(created.sessions).toHaveLength(1);
    expect(created.sessions[0].meetLink).toMatch(/^https:/);
    expect(kabulParts(new Date(created.sessions[0].startTime))).toEqual({ day: 2, hour: 18, minute: 0 });

    const unset = await makeTeacher("create-unset");
    const waiting = await createClassWithSession({
      name: `${TAG} waiting`,
      subjectCategory: "English",
      description: "fixture",
      teacherId: unset.id,
      maxStudents: 10,
      durationMinutes: 60,
      schedulePreference: "Tue 6:00 PM",
      language: "English",
    });
    // No saved availability: the posted time is booked (decision 2026-10-14).
    expect(waiting.scheduleIssue).toBeNull();
    expect(waiting.sessions).toHaveLength(1);
    expect(kabulParts(new Date(waiting.sessions[0].startTime))).toEqual({ day: 2, hour: 18, minute: 0 });
  });
});
