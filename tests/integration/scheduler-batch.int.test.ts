/**
 * Regression tests for the auto-scheduler's batch claim against a REAL Postgres.
 *
 * Production stalled for 3.5 months on this: a SchedulerJob row written on
 * 2026-04-27 held totalCount=12 while the active-class list had since shrunk to
 * 2. Every hourly run then computed slice(2, min(12, 2)) = slice(2, 2) — an empty
 * batch — and `end >= totalCount` (2 >= 12) was never true, so the row never
 * closed and no replacement job was ever created. No session was generated after
 * 25 April.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { runSchedulerBatch } from "@/lib/platform/db-store";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "schedbatch";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  await prisma.schedulerJob.deleteMany({});
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.teacherAvailability.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

/** A teacher with availability, so the scheduler's availability gate lets them through. */
async function makeTeacherWithAvailability(slug: string) {
  const teacher = await prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "TEACHER", approvedAt: new Date() },
    select: { id: true },
  });
  await prisma.teacherAvailability.create({
    data: {
      teacherId: teacher.id,
      dayOfWeek: 3,
      startTimeUTC: new Date("1970-01-01T14:00:00Z"),
      endTimeUTC: new Date("1970-01-01T15:00:00Z"),
    },
  });
  return teacher;
}

async function makeAutoClass(teacherId: string, name: string) {
  return prisma.class.create({
    data: {
      name: `${TAG} ${name}`,
      subjectCategory: "English",
      description: "fixture",
      teacherId,
      maxStudents: 10,
      durationMinutes: 60,
      schedulingMode: "AUTO",
    },
    select: { id: true },
  });
}

d("scheduler batch claim", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("recovers when a stale RUNNING job records more classes than now exist", async () => {
    const teacher = await makeTeacherWithAvailability("stale");
    const klass = await makeAutoClass(teacher.id, "needs-a-session");

    const activeCount = await prisma.class.count({ where: { status: "ACTIVE", schedulingMode: "AUTO" } });

    // Reproduce production exactly: cursor parked at the live total, totalCount
    // inflated by classes that have since been archived.
    await prisma.schedulerJob.create({
      data: {
        status: "RUNNING",
        processedCount: activeCount,
        totalCount: activeCount + 10,
      },
    });

    // First tick closes the stranded row instead of looping on an empty slice.
    // Before the fix this assertion failed forever: the row stayed RUNNING and
    // the batch was always empty.
    await runSchedulerBatch();
    expect(await prisma.schedulerJob.count({ where: { status: "RUNNING" } })).toBe(0);

    // Subsequent ticks start a fresh job and work through the list ten classes
    // at a time, so allow enough ticks to reach ours (seeded demo classes sort
    // ahead of it by createdAt).
    const ticks = Math.ceil((activeCount + 1) / 10) + 1;
    for (let i = 0; i < ticks; i += 1) {
      await runSchedulerBatch();
      if (await prisma.session.count({ where: { classId: klass.id } })) break;
    }

    expect(await prisma.session.count({ where: { classId: klass.id } })).toBeGreaterThan(0);
  });

  it("keeps the stored total in step with the live class count", async () => {
    const teacher = await makeTeacherWithAvailability("resync");
    await makeAutoClass(teacher.id, "one");

    await runSchedulerBatch();

    const job = await prisma.schedulerJob.findFirst({ orderBy: { createdAt: "desc" } });
    const live = await prisma.class.count({ where: { status: "ACTIVE", schedulingMode: "AUTO" } });
    expect(job?.totalCount).toBe(live);
  });

  it("still refuses to schedule a class whose teacher has no availability", async () => {
    // The gate exists so the scheduler never invents a time the teacher may not
    // attend (QA 2026-04-19). Unsticking the batch claim must not weaken it.
    const teacher = await prisma.user.create({
      data: { name: `${TAG} no-avail`, email: email("no-avail"), role: "TEACHER", approvedAt: new Date() },
      select: { id: true },
    });
    const klass = await makeAutoClass(teacher.id, "unschedulable");

    await runSchedulerBatch();
    await runSchedulerBatch();

    expect(await prisma.session.count({ where: { classId: klass.id } })).toBe(0);
  });
});
