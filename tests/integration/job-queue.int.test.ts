/**
 * Integration tests for the Postgres-backed job queue against a REAL database.
 * Proves the load-bearing semantics: concurrent claim isolation (SKIP LOCKED),
 * idempotent enqueue (dedupeKey), retry-with-backoff, and dead-lettering.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { backoffSeconds, claim, enqueue, markCompleted, markFailed, queueStats } from "@/lib/jobs/queue";
import { drainOnce, registerHandler } from "@/lib/jobs/worker";
import { emit } from "@/lib/events/bus";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;

async function reset() {
  await prisma.job.deleteMany({});
}

d("job queue integration (real Postgres)", () => {
  beforeEach(reset);
  afterAll(async () => {
    await reset();
    await prisma.$disconnect();
  });

  it("enqueues and claims a due job exactly once across concurrent workers", async () => {
    await enqueue("test_noop", { n: 1 });
    // Two workers race to claim the single job; SKIP LOCKED must give it to one.
    const [a, b] = await Promise.all([claim("worker-a", 10), claim("worker-b", 10)]);
    const total = a.length + b.length;
    expect(total).toBe(1);
    expect(a.length === 1 || b.length === 1).toBe(true);
  });

  it("does not claim jobs whose runAt is in the future", async () => {
    await enqueue("test_noop", {}, { runAt: new Date(Date.now() + 60_000) });
    const claimed = await claim("w", 10);
    expect(claimed.length).toBe(0);
  });

  it("dedupeKey makes enqueue idempotent while a job is live", async () => {
    const first = await enqueue("test_noop", {}, { dedupeKey: "unique-123" });
    const second = await enqueue("test_noop", {}, { dedupeKey: "unique-123" });
    expect(second.deduped).toBe(true);
    expect(second.id).toBe(first.id);
    const count = await prisma.job.count({ where: { dedupeKey: "unique-123" } });
    expect(count).toBe(1);
  });

  it("orders due work by priority desc then runAt asc", async () => {
    await enqueue("test_noop", { tag: "low" }, { priority: 0 });
    await enqueue("test_noop", { tag: "high" }, { priority: 10 });
    const [firstBatch] = [await claim("w", 1)];
    expect(firstBatch.length).toBe(1);
    expect((firstBatch[0]!.payload as { tag: string }).tag).toBe("high");
  });

  it("retries with exponential backoff, then dead-letters after maxAttempts", async () => {
    const { id } = await enqueue("test_fail", {}, { maxAttempts: 3 });

    // Attempt 1: fails -> FAILED, runAt pushed out by backoff.
    let job = (await prisma.job.findUniqueOrThrow({ where: { id } }));
    const claim1 = await claim("w", 10);
    expect(claim1.length).toBe(1);
    const r1 = await markFailed(claim1[0]!, new Error("boom"));
    expect(r1).toBe("retry");
    job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("FAILED");
    expect(job.attempts).toBe(1);
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now()); // backed off into the future

    // Force it due again and fail attempts 2 and 3.
    await prisma.job.update({ where: { id }, data: { runAt: new Date(Date.now() - 1000) } });
    const claim2 = await claim("w", 10);
    expect(await markFailed(claim2[0]!, new Error("boom"))).toBe("retry");

    await prisma.job.update({ where: { id }, data: { runAt: new Date(Date.now() - 1000) } });
    const claim3 = await claim("w", 10);
    expect(await markFailed(claim3[0]!, new Error("boom"))).toBe("dead");

    job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("DEAD");
    expect(job.attempts).toBe(3);
    expect(job.lastError).toContain("boom");
  });

  it("backoff schedule increases and caps", () => {
    expect(backoffSeconds(1)).toBeLessThan(backoffSeconds(3));
    expect(backoffSeconds(99)).toBe(backoffSeconds(5)); // capped at the last entry
  });

  it("drainOnce dispatches to handlers, completing good jobs and dead-lettering unknown types", async () => {
    const seen: number[] = [];
    registerHandler("test_collect", async (payload) => {
      seen.push(Number(payload.n));
    });

    await enqueue("test_collect", { n: 7 });
    await enqueue("test_unknown_type", {}, { maxAttempts: 1 }); // no handler -> dead-letters immediately

    const res = await drainOnce({ workerId: "w", batchSize: 10 });
    expect(res.processed).toBe(2);
    expect(res.succeeded).toBe(1);
    expect(res.deadLettered).toBe(1);
    expect(seen).toEqual([7]);

    const stats = await queueStats();
    expect(stats.COMPLETED).toBe(1);
    expect(stats.DEAD).toBe(1);
  });

  it("a handler that throws leaves the job retryable, and completing marks COMPLETED", async () => {
    let attempts = 0;
    registerHandler("test_flaky", async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("first fails");
    });
    const { id } = await enqueue("test_flaky", {}, { maxAttempts: 3 });

    await drainOnce({ workerId: "w", batchSize: 10 });
    let job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("FAILED");

    // Make it due and drain again -> succeeds.
    await prisma.job.update({ where: { id }, data: { runAt: new Date(Date.now() - 1000) } });
    await drainOnce({ workerId: "w", batchSize: 10 });
    job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("COMPLETED");
    expect(attempts).toBe(2);
  });

  it("event bus emits one durable job per subscriber, idempotently", async () => {
    // student.enrolled -> [welcome_student]
    const ids1 = await emit("student.enrolled", { studentId: "s1", classId: "c1" }, { dedupeKey: "enr:s1:c1" });
    const ids2 = await emit("student.enrolled", { studentId: "s1", classId: "c1" }, { dedupeKey: "enr:s1:c1" });
    expect(ids1.length).toBe(1);
    // Same dedupeKey -> the second emit reuses the same job.
    expect(ids2).toEqual(ids1);
    const jobs = await prisma.job.findMany({ where: { type: "welcome_student" } });
    expect(jobs.length).toBe(1);
    expect((jobs[0]!.payload as { studentId: string }).studentId).toBe("s1");
  });

  it("markCompleted clears the lock and error", async () => {
    const { id } = await enqueue("test_noop", {});
    const claimed = await claim("w", 10);
    await markCompleted(claimed[0]!.id);
    const job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("COMPLETED");
    expect(job.lockedBy).toBeNull();
  });
});
