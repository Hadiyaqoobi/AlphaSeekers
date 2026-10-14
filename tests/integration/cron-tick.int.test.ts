/**
 * The gated cron tick against a REAL Postgres, counting every SQL statement.
 *
 * ADR-0008's saving rests on one claim: an hourly tick with nothing due sends
 * the database NO query, so Neon's compute stays suspended. This test installs a
 * Prisma client that emits an event per statement (as the process-wide client,
 * before anything imports `@/lib/prisma`), calls the real route handler, and
 * counts.
 *
 * "Now" is faked into 2099 so that no row left by another test file can make
 * anything due; only `Date` is faked, the queries are real I/O.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "crontick";
const T0 = Date.parse("2099-01-01T01:00:00Z"); // before the daily hour (02 UTC)
const MINUTE = 60 * 1000;

d("gated cron tick (real Postgres, statement counter)", () => {
  let statements = 0;
  let base: PrismaClient<Prisma.PrismaClientOptions, "query">;
  let POST: typeof import("@/app/api/cron/tick/route").POST;
  let refreshAgenda: () => Promise<unknown>;
  let NextRequestCtor: typeof import("next/server").NextRequest;

  async function tick() {
    const response = await POST(
      new NextRequestCtor("https://alphaseekers.org/api/cron/tick", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    return response.json();
  }

  async function cleanup() {
    const users = await base.user.findMany({
      where: { email: { startsWith: `${TAG}+` } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await base.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
      await base.class.deleteMany({ where: { teacherId: { in: ids } } });
      await base.user.deleteMany({ where: { id: { in: ids } } });
    }
    await base.job.deleteMany({ where: { runAt: { gte: new Date("2098-01-01T00:00:00Z") } } });
  }

  beforeAll(async () => {
    process.env.CRON_SECRET = "int-test-secret";

    base = new PrismaClient({
      log: [{ emit: "event", level: "query" }],
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    base.$on("query", () => {
      statements += 1;
    });
    // Must happen before the first import of "@/lib/prisma", which reuses it.
    globalThis.prisma = base as unknown as PrismaClient;

    // Nothing live may be left in the queue, or "a job is due" would be true.
    // This database is the disposable test one, and test files run serially.
    await base.job.deleteMany({ where: { status: { in: ["PENDING", "FAILED", "ACTIVE"] } } });
    await base.schedulerJob.updateMany({ where: { status: "RUNNING" }, data: { status: "COMPLETED" } });
    await cleanup();

    ({ POST } = await import("@/app/api/cron/tick/route"));
    ({ refreshAgenda } = await import("@/lib/platform/agenda"));
    ({ NextRequest: NextRequestCtor } = await import("next/server"));
    const { resetAgendaForTests } = await import("@/lib/platform/agenda");
    resetAgendaForTests();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await cleanup();
    await base.$disconnect();
    // Do not leak the un-extended client to later test files.
    globalThis.prisma = undefined;
    const { resetAgendaForTests } = await import("@/lib/platform/agenda");
    resetAgendaForTests();
  });

  it("queries on the first tick after a restart, then not at all while nothing is due", async () => {
    statements = 0;
    const first = await tick();
    expect(first).toMatchObject({ skipped: false, reasons: ["cold"] });
    expect(statements).toBeGreaterThan(0);

    // Half an hour later: no session within the lead, no job, not the daily hour.
    vi.setSystemTime(T0 + 30 * MINUTE);
    statements = 0;
    const second = await tick();
    expect(second).toEqual({ skipped: true });
    expect(statements).toBe(0);

    // And again, to be sure the skip itself left nothing behind.
    statements = 0;
    expect(await tick()).toEqual({ skipped: true });
    expect(statements).toBe(0);
  });

  it("wakes the database once a session is within the reminder lead", async () => {
    const teacher = await base.user.create({
      data: { name: `${TAG} teacher`, email: `${TAG}+teacher@example.com`, role: "TEACHER" },
      select: { id: true },
    });
    const klass = await base.class.create({
      data: {
        name: `${TAG} class`,
        subjectCategory: "English",
        description: "fixture",
        teacherId: teacher.id,
        maxStudents: 10,
      },
      select: { id: true },
    });
    await base.session.create({
      data: {
        classId: klass.id,
        startTime: new Date(T0 + 105 * MINUTE), // 75 min after the tick below
        endTime: new Date(T0 + 165 * MINUTE),
      },
    });
    // What the Prisma extension does after a Session write (this test's client
    // is deliberately un-extended so it can count statements).
    await refreshAgenda();

    vi.setSystemTime(T0 + 30 * MINUTE);
    statements = 0;
    const result = await tick();

    expect(result.skipped).toBe(false);
    expect(result.reasons).toContain("session-soon");
    expect(result.steps).toHaveProperty("reminders");
    expect(result.steps).toHaveProperty("aiPrep");
    expect(statements).toBeGreaterThan(0);
  });
});
