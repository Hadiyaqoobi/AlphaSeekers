/**
 * The tick agenda's automatic refresh, against a REAL Postgres.
 *
 * The gated tick (ADR-0008) only wakes the database when its in-memory agenda
 * says something is due. That is safe only if the agenda learns about new
 * sessions and newly queued jobs on its own; a session created by a teacher
 * that the agenda never hears about would get no reminder. These tests prove the
 * Prisma extension refreshes it after writes to `Session` and `Job`, with no
 * call site involved.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { enqueue } from "@/lib/jobs/queue";
import { prisma } from "@/lib/prisma";
import {
  getAgenda,
  planTick,
  refreshAgenda,
  resetAgendaForTests,
  type Agenda,
} from "@/lib/platform/agenda";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "agendahook";
const MINUTE = 60 * 1000;

async function cleanup() {
  // Any live job would make "a job is due" true before the test enqueues one.
  // This is the disposable test database, and test files run serially.
  await prisma.job.deleteMany({ where: { status: { in: ["PENDING", "FAILED", "ACTIVE"] } } });
  await prisma.job.deleteMany({ where: { dedupeKey: { startsWith: `${TAG}:` } } });
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

/** Let the debounced refresh (already fired by the fake timer) finish its real I/O. */
async function until(predicate: (agenda: Agenda | null) => boolean) {
  for (let i = 0; i < 5000; i += 1) {
    if (predicate(getAgenda())) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("agenda never caught up");
}

d("tick agenda refresh (real Postgres)", () => {
  beforeEach(async () => {
    await cleanup();
    resetAgendaForTests();
    await refreshAgenda();
    // Only the debounce timer is faked; queries are real I/O.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAgendaForTests();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("learns about a new session from the write itself, after the debounce", async () => {
    const startsAt = Date.now() + 40 * MINUTE;
    const teacher = await prisma.user.create({
      data: { name: `${TAG} teacher`, email: `${TAG}+teacher@example.com`, role: "TEACHER" },
      select: { id: true },
    });
    const klass = await prisma.class.create({
      data: {
        name: `${TAG} class`,
        subjectCategory: "English",
        description: "fixture",
        teacherId: teacher.id,
        maxStudents: 10,
      },
      select: { id: true },
    });
    await prisma.session.create({
      data: { classId: klass.id, startTime: new Date(startsAt), endTime: new Date(startsAt + 60 * MINUTE) },
    });

    // Not yet: the refresh waits for writes to settle.
    expect(getAgenda()?.sessionStarts).not.toContain(startsAt);

    await vi.advanceTimersByTimeAsync(6_000);
    await until((agenda) => Boolean(agenda?.sessionStarts.includes(startsAt)));

    expect(planTick(getAgenda(), Date.now()).sessionWork).toBe(true);
  });

  it("learns that a job is due from the enqueue itself", async () => {
    expect(getAgenda()?.nextJobAt).toBeNull();

    await enqueue("send_notification", {}, { dedupeKey: `${TAG}:job` });

    await vi.advanceTimersByTimeAsync(6_000);
    await until((agenda) => agenda?.nextJobAt !== null && agenda?.nextJobAt !== undefined);

    expect(planTick(getAgenda(), Date.now() + 1000).reasons).toContain("job-due");
  });
});
