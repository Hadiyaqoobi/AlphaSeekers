/**
 * Durable, Postgres-backed job queue.
 *
 * Design notes (the interesting bits):
 *  - Claiming uses `SELECT ... FOR UPDATE SKIP LOCKED` so N workers can drain the
 *    queue concurrently without ever handing the same job to two workers. The row
 *    lock is held only for the instant it takes to flip status→ACTIVE.
 *  - Retries use exponential backoff (runAt pushed into the future); after
 *    `maxAttempts` a job dead-letters (status=DEAD) for human inspection.
 *  - `dedupeKey` provides idempotency: enqueueing a logical job whose key is
 *    already live (PENDING/ACTIVE/FAILED) is a no-op. This lets schedulers run
 *    every minute without creating duplicate work.
 *
 * No external broker (Redis/SQS) — the app already depends on Postgres, and a
 * transactional queue that shares the DB gives exactly-once-ish semantics with
 * app writes. See docs/adr/0006-postgres-job-queue.md.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type EnqueueOptions = {
  /** Delay before the job becomes due. */
  runAt?: Date;
  /** Higher runs first among due jobs. */
  priority?: number;
  /** Idempotency key: skip if a live job already holds it. */
  dedupeKey?: string;
  maxAttempts?: number;
};

export type ClaimedJob = {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
};

/** Backoff schedule in seconds, indexed by attempt number (capped). */
export function backoffSeconds(attempt: number): number {
  const schedule = [10, 30, 120, 600, 1800, 3600];
  return schedule[Math.min(attempt, schedule.length - 1)]!;
}

/**
 * Enqueue a job. If `dedupeKey` is supplied and a live job (not COMPLETED/DEAD)
 * already holds it, returns that job's id instead of creating a duplicate.
 */
export async function enqueue(
  type: string,
  payload: Record<string, unknown> = {},
  options: EnqueueOptions = {},
): Promise<{ id: string; deduped: boolean }> {
  const data = {
    type,
    payload: payload as Prisma.InputJsonValue,
    runAt: options.runAt ?? new Date(),
    priority: options.priority ?? 0,
    dedupeKey: options.dedupeKey ?? null,
    maxAttempts: options.maxAttempts ?? 5,
  };

  // Fast path: no idempotency key ⇒ a plain insert (no conflict possible).
  if (!options.dedupeKey) {
    const job = await prisma.job.create({ data, select: { id: true } });
    return { id: job.id, deduped: false };
  }

  // Idempotent path: createMany({ skipDuplicates }) issues an
  // INSERT ... ON CONFLICT DO NOTHING, so a thundering herd of identical keys
  // dedupes WITHOUT throwing — and therefore without spamming the error log,
  // unlike catching the unique-violation. Exactly one row ends up holding the
  // key; read it back to return its id.
  const inserted = await prisma.job.createMany({ data: [data], skipDuplicates: true });
  const row = await prisma.job.findFirstOrThrow({
    where: { dedupeKey: options.dedupeKey },
    select: { id: true },
  });
  return { id: row.id, deduped: inserted.count === 0 };
}

/**
 * Atomically claim up to `limit` due jobs for `workerId`, flipping them to
 * ACTIVE. Uses FOR UPDATE SKIP LOCKED so concurrent workers never collide.
 */
export async function claim(workerId: string, limit: number): Promise<ClaimedJob[]> {
  // Prisma stores DateTime as `timestamp without time zone` holding the UTC
  // wall-clock. Comparing that column to a JS Date param would make Postgres
  // apply the session timezone and shift "now", so we compute the current time
  // entirely in SQL as a UTC-naive timestamp (`now() AT TIME ZONE 'UTC'`) to
  // match the stored representation exactly.
  const rows = await prisma.$queryRaw<
    Array<{ id: string; type: string; payload: Prisma.JsonValue; attempts: number; maxAttempts: number }>
  >`
    UPDATE "Job" AS j
    SET "status" = 'ACTIVE',
        "lockedAt" = (now() AT TIME ZONE 'UTC'),
        "lockedBy" = ${workerId},
        "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE j."id" IN (
      SELECT "id" FROM "Job"
      WHERE "status" IN ('PENDING', 'FAILED') AND "runAt" <= (now() AT TIME ZONE 'UTC')
      ORDER BY "priority" DESC, "runAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING j."id", j."type", j."payload", j."attempts", j."maxAttempts";
  `;
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: r.payload,
    attempts: r.attempts,
    maxAttempts: r.maxAttempts,
  }));
}

export async function markCompleted(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "COMPLETED", lockedAt: null, lockedBy: null, lastError: null },
  });
}

/**
 * Record a failed attempt. Increments attempts; retries with backoff while
 * attempts < maxAttempts, otherwise dead-letters (DEAD).
 */
export async function markFailed(job: ClaimedJob, error: unknown): Promise<"retry" | "dead"> {
  const attempts = job.attempts + 1;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const willRetry = attempts < job.maxAttempts;

  await prisma.job.update({
    where: { id: job.id },
    data: {
      attempts,
      status: willRetry ? "FAILED" : "DEAD",
      runAt: willRetry ? new Date(Date.now() + backoffSeconds(attempts) * 1000) : undefined,
      lockedAt: null,
      lockedBy: null,
      lastError: message.slice(0, 2000),
    },
  });
  return willRetry ? "retry" : "dead";
}

/**
 * Reclaim jobs stuck in ACTIVE beyond `staleMs` (worker crashed mid-job): flip
 * them back to FAILED so they get retried. Run periodically.
 */
export async function reapStalled(staleMs: number = 5 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const res = await prisma.job.updateMany({
    where: { status: "ACTIVE", lockedAt: { lt: cutoff } },
    data: { status: "FAILED", lockedAt: null, lockedBy: null },
  });
  return res.count;
}

export async function queueStats(): Promise<Record<string, number>> {
  const groups = await prisma.job.groupBy({ by: ["status"], _count: { _all: true } });
  const out: Record<string, number> = { PENDING: 0, ACTIVE: 0, COMPLETED: 0, FAILED: 0, DEAD: 0 };
  for (const g of groups) out[g.status] = g._count._all;
  return out;
}

/** A dead-lettered job, trimmed to the fields the ops panel renders. */
export type DeadJob = {
  id: string;
  type: string;
  attempts: number;
  lastError: string | null;
  updatedAt: Date;
};

/**
 * Recent DEAD (retry-exhausted) jobs, newest first, for human inspection in the
 * super console. `updatedAt` is when the job dead-lettered.
 */
export async function listDeadJobs(limit: number = 50): Promise<DeadJob[]> {
  return prisma.job.findMany({
    where: { status: "DEAD" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, type: true, attempts: true, lastError: true, updatedAt: true },
  });
}

/**
 * Requeue a stuck job: reset it to PENDING and due now, clearing the attempt
 * counter, lock and last error so a worker picks it up fresh. Scoped by
 * `status IN (DEAD, FAILED)` in a single updateMany so a job that has since
 * been COMPLETED or grabbed by a worker (ACTIVE) is never disturbed.
 * `ok` is true only when a row actually transitioned.
 */
export async function requeueJob(id: string): Promise<{ ok: boolean }> {
  const res = await prisma.job.updateMany({
    where: { id, status: { in: ["DEAD", "FAILED"] } },
    data: {
      status: "PENDING",
      runAt: new Date(),
      attempts: 0,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
  return { ok: res.count > 0 };
}

/**
 * Queue health snapshot for ops dashboards: the per-status counts plus the age
 * (ms) of the oldest PENDING job — a rising oldest-pending age is the earliest
 * sign of a stalled or under-provisioned worker. Null when nothing is pending.
 */
export async function queueHealth(): Promise<{
  counts: Record<string, number>;
  oldestPendingAgeMs: number | null;
}> {
  const [counts, oldest] = await Promise.all([
    queueStats(),
    prisma.job.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  const oldestPendingAgeMs = oldest ? Date.now() - oldest.createdAt.getTime() : null;
  return { counts, oldestPendingAgeMs };
}
