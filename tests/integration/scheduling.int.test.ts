/**
 * Integration tests for instructor-managed scheduling against a REAL Postgres.
 * Covers create / reschedule / confirm, Meet-link status, confirmedAt stamping,
 * and the student-notification event flowing through the queue to the worker.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createManualSession, confirmSession, rescheduleSession } from "@/lib/scheduling/sessions";
import { drainOnce } from "@/lib/jobs/worker";
import { registerAllHandlers } from "@/lib/jobs/handlers";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "sched";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  await prisma.job.deleteMany({});
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeClassWithStudent() {
  const teacher = await prisma.user.create({ data: { name: "T", email: email("teacher"), role: "TEACHER" } });
  const student = await prisma.user.create({
    data: { name: "S", email: email("student"), role: "STUDENT", approvedAt: new Date() },
  });
  const klass = await prisma.class.create({
    data: {
      name: "Manual Class",
      subjectCategory: "math",
      description: "x",
      teacherId: teacher.id,
      maxStudents: 20,
      schedulingMode: "MANUAL",
    },
  });
  await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, status: "ACTIVE" } });
  return { teacher, student, klass };
}

const inTwoDays = () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

d("instructor scheduling (real Postgres)", () => {
  beforeAll(() => registerAllHandlers());
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("creates a session at an explicit time, stamped confirmed, with a Meet link status", async () => {
    const { klass } = await makeClassWithStudent();
    const when = inTwoDays();
    const res = await createManualSession({ classId: klass.id, startTime: when, durationMinutes: 90 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const s = await prisma.session.findUniqueOrThrow({ where: { id: res.sessionId } });
    expect(s.startTime.getTime()).toBe(when.getTime());
    expect(s.endTime.getTime()).toBe(when.getTime() + 90 * 60_000);
    expect(s.confirmedAt).not.toBeNull();
    expect(["GENERATED", "PENDING", "FAILED"]).toContain(s.meetLinkStatus);
  });

  it("rejects a start time in the past", async () => {
    const { klass } = await makeClassWithStudent();
    const res = await createManualSession({ classId: klass.id, startTime: new Date(Date.now() - 3 * 60 * 60 * 1000) });
    expect(res.ok).toBe(false);
  });

  it("emits a notification job that the worker delivers to enrolled students", async () => {
    const { klass } = await makeClassWithStudent();
    await createManualSession({ classId: klass.id, startTime: inTwoDays() });

    const pending = await prisma.job.findFirst({ where: { type: "notify_session_scheduled", status: "PENDING" } });
    expect(pending).toBeTruthy();

    const drained = await drainOnce({ workerId: "test", batchSize: 10 });
    expect(drained.succeeded).toBe(1);
    const job = await prisma.job.findFirstOrThrow({ where: { type: "notify_session_scheduled" } });
    expect(job.status).toBe("COMPLETED");
  });

  it("reschedules a session to a new time and re-stamps confirmedAt", async () => {
    const { klass } = await makeClassWithStudent();
    const created = await createManualSession({ classId: klass.id, startTime: inTwoDays() });
    if (!created.ok) throw new Error("setup failed");

    const newTime = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const res = await rescheduleSession({ sessionId: created.sessionId, startTime: newTime });
    expect(res.ok).toBe(true);
    const s = await prisma.session.findUniqueOrThrow({ where: { id: created.sessionId } });
    expect(s.startTime.getTime()).toBe(newTime.getTime());
    expect(s.confirmedAt).not.toBeNull();
  });

  it("confirms an auto-proposed session without changing its time", async () => {
    const { teacher, klass } = await makeClassWithStudent();
    const when = inTwoDays();
    const s = await prisma.session.create({
      data: { classId: klass.id, startTime: when, endTime: new Date(when.getTime() + 3600_000) },
    });
    expect(s.confirmedAt).toBeNull();
    void teacher;

    const res = await confirmSession(s.id);
    expect(res.ok).toBe(true);
    const after = await prisma.session.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.confirmedAt).not.toBeNull();
    expect(after.startTime.getTime()).toBe(when.getTime());
  });

  it("rejects rescheduling a cancelled session", async () => {
    const { klass } = await makeClassWithStudent();
    const created = await createManualSession({ classId: klass.id, startTime: inTwoDays() });
    if (!created.ok) throw new Error("setup failed");
    await prisma.session.update({ where: { id: created.sessionId }, data: { cancelled: true } });
    const res = await rescheduleSession({ sessionId: created.sessionId, startTime: inTwoDays() });
    expect(res.ok).toBe(false);
  });
});

/**
 * Guard the relationship between the cron pulse and the reminder window.
 *
 * The database scales to zero between pulses to stay inside the compute budget,
 * so the pulse is hourly (render.yaml). If the reminder window is ever
 * made narrower than that interval, sessions fall between runs and their
 * reminder is silently never sent — no error, just a class nobody was told about.
 */
describe("reminder window vs cron pulse", () => {
  it("keeps the reminder window wider than the hourly pulse", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/platform/db-store.ts", "utf8");
    const match = src.match(/const REMINDER_WINDOW_MINUTES = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThan(60);
  });

  it("keeps the AI prep window wider than the pulse too", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/app/api/cron/ai-prep/route.ts", "utf8");
    const min = Number(src.match(/const PREP_WINDOW_MIN = (\d+)/)![1]);
    const max = Number(src.match(/const PREP_WINDOW_MAX = (\d+)/)![1]);
    expect(max - min).toBeGreaterThan(60);
  });
});
