/**
 * End-to-end automation proof against a REAL Postgres: a domain event is emitted,
 * flows through the durable queue, and is processed by the actual registered
 * handler via the worker drain — exercising event → queue → worker → handler.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/queue";
import { drainOnce } from "@/lib/jobs/worker";
import { registerAllHandlers, REGISTERED_JOB_TYPES } from "@/lib/jobs/handlers";
import { emit } from "@/lib/events/bus";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "e2e";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  await prisma.job.deleteMany({});
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

d("automation end-to-end (real Postgres)", () => {
  beforeAll(() => {
    registerAllHandlers();
  });
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("registers every declared job type", () => {
    for (const t of ["welcome_student", "session_reminder", "kpi_digest", "run_reminders", "run_scheduler"]) {
      expect(REGISTERED_JOB_TYPES).toContain(t);
    }
  });

  it("student.enrolled event flows through the queue and the worker completes the welcome job", async () => {
    const teacher = await prisma.user.create({ data: { name: "T", email: email("teacher"), role: "TEACHER" } });
    const student = await prisma.user.create({
      data: { name: "Newcomer", email: email("student"), role: "STUDENT", approvedAt: new Date() },
    });
    const klass = await prisma.class.create({
      data: { name: "Intro to Algebra", subjectCategory: "math", description: "x", teacherId: teacher.id, maxStudents: 20 },
    });
    await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, status: "ACTIVE" } });

    // Producer side: emit the domain event (as the enroll route now does).
    const ids = await emit(
      "student.enrolled",
      { studentId: student.id, classId: klass.id },
      { dedupeKey: `enrolled:${student.id}:${klass.id}` },
    );
    // student.enrolled fans out to welcome_student + welcome_teacher (single
    // notification path — the inline db-store welcome was retired).
    expect(ids.length).toBe(2);

    // A durable welcome_student job is now pending.
    const pending = await prisma.job.findFirst({ where: { type: "welcome_student", status: "PENDING" } });
    expect(pending).toBeTruthy();

    // Worker side: drain and process both with the real handlers.
    const res = await drainOnce({ workerId: "test", batchSize: 10 });
    expect(res.succeeded).toBe(2);
    expect(res.deadLettered).toBe(0);

    const studentJob = await prisma.job.findFirstOrThrow({ where: { type: "welcome_student" } });
    expect(studentJob.status).toBe("COMPLETED");
    const teacherJob = await prisma.job.findFirstOrThrow({ where: { type: "welcome_teacher" } });
    expect(teacherJob.status).toBe("COMPLETED");
  });

  it("kpi_digest job computes KPIs and completes when a super admin exists", async () => {
    await prisma.user.create({
      data: {
        name: "Root",
        email: email("super"),
        role: "ADMIN",
        accessLevel: "SUPER_ADMIN",
        approvedAt: new Date(),
      },
    });
    await enqueue("kpi_digest", {}, { dedupeKey: "e2e-digest" });
    const res = await drainOnce({ workerId: "test", batchSize: 10 });
    expect(res.succeeded).toBe(1);
    const job = await prisma.job.findFirstOrThrow({ where: { type: "kpi_digest" } });
    expect(job.status).toBe("COMPLETED");
  });

  it("run_scheduler and run_reminders operational jobs drain without error", async () => {
    await enqueue("run_scheduler", {});
    await enqueue("run_reminders", {});
    const res = await drainOnce({ workerId: "test", batchSize: 10 });
    expect(res.processed).toBe(2);
    expect(res.deadLettered).toBe(0);
  });

  it("a welcome job for a since-deleted student completes quietly (no dead-letter)", async () => {
    await enqueue("welcome_student", { studentId: "does-not-exist", classId: "nope" });
    const res = await drainOnce({ workerId: "test", batchSize: 10 });
    // Missing entity ⇒ handler returns quietly ⇒ job completes, not dead-lettered.
    expect(res.succeeded).toBe(1);
    expect(res.deadLettered).toBe(0);
  });
});
