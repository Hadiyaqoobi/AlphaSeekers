/**
 * In-process "drain soon" kick for the job queue.
 *
 * The queue is otherwise drained only by the hourly cron pulse, so a welcome,
 * an announcement or an enrollment email could sit for up to an hour, and a
 * job whose retry was due in 10 seconds waited for the next pulse too. Since a
 * job is almost always enqueued from a web request on the one web instance, that
 * instance can simply drain it a moment later.
 *
 * Rules, all deliberate:
 *  - Debounced: the first enqueue arms a ~2 s timer; further enqueues inside
 *    that window ride the same drain (a 40-recipient announcement is one drain,
 *    not forty).
 *  - One at a time: never two drains in this process; an enqueue during a drain
 *    schedules exactly one follow-up.
 *  - Never throws, never blocks the request: it runs on a timer, and every
 *    error is logged and swallowed. The hourly drain remains the backstop, and
 *    claim's SKIP LOCKED means the two can never process the same job.
 *  - Database-friendly: it only ever runs right after a request that already
 *    woke the database. A follow-up for a quick retry (30 s / 2 min backoff) is
 *    scheduled only when that retry falls inside RETRY_FOLLOW_UP_MS.
 *  - Off in tests (vitest sets VITEST / NODE_ENV=test) unless
 *    JOBS_BACKGROUND_DRAIN=on, and off anywhere JOBS_BACKGROUND_DRAIN=off.
 *
 * Worker and handler modules are imported lazily: queue.ts imports this file,
 * and the worker imports queue.ts, so a static import here would be circular.
 */

import { logger } from "@/lib/observability/logger";

const DEBOUNCE_MS = 2000;
/** Upper bound per kick so one huge fan-out cannot monopolise the web process. */
const MAX_BATCHES = 20;
const BATCH_SIZE = 10;
/** Only chase a retry that is due this soon; later ones wait for the pulse. */
const RETRY_FOLLOW_UP_MS = 5 * 60 * 1000;

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let rerunRequested = false;

export function isBackgroundDrainEnabled(): boolean {
  const flag = (process.env.JOBS_BACKGROUND_DRAIN ?? "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(flag)) return false;
  if (["1", "true", "on", "yes"].includes(flag)) return true;
  // Default: on in a running app, off under the test runner.
  return process.env.NODE_ENV !== "test" && !process.env.VITEST;
}

/**
 * Arrange for the queue to be drained shortly. Safe to call from anywhere, any
 * number of times; it returns immediately.
 */
export function scheduleBackgroundDrain(delayMs: number = DEBOUNCE_MS): void {
  if (!isBackgroundDrainEnabled()) return;
  if (running) {
    rerunRequested = true;
    return;
  }
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void runDrain();
  }, Math.max(0, delayMs));
  // Never keep a process alive just for this.
  (timer as { unref?: () => void }).unref?.();
}

async function runDrain(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return;
  }
  running = true;
  rerunRequested = false;
  let followUpMs: number | null = null;

  try {
    const [{ registerAllHandlers }, { drainOnce }] = await Promise.all([
      import("@/lib/jobs/handlers"),
      import("@/lib/jobs/worker"),
    ]);
    registerAllHandlers();

    let retried = 0;
    for (let i = 0; i < MAX_BATCHES; i += 1) {
      const result = await drainOnce({ workerId: `web-${process.pid}`, batchSize: BATCH_SIZE });
      retried += result.retried;
      if (result.processed === 0) break;
    }

    if (retried > 0) {
      followUpMs = await msUntilNextRetry();
    }
  } catch (error) {
    logger.warn("background job drain failed; the hourly drain will pick the work up", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }

  if (rerunRequested) {
    rerunRequested = false;
    scheduleBackgroundDrain();
  } else if (followUpMs !== null) {
    scheduleBackgroundDrain(followUpMs);
  }
}

/** Delay until the earliest retry, if it is due within RETRY_FOLLOW_UP_MS. */
async function msUntilNextRetry(): Promise<number | null> {
  const { prisma } = await import("@/lib/prisma");
  const next = await prisma.job.findFirst({
    where: { status: "FAILED" },
    orderBy: { runAt: "asc" },
    select: { runAt: true },
  });
  if (!next) return null;
  const wait = next.runAt.getTime() - Date.now();
  if (wait > RETRY_FOLLOW_UP_MS) return null;
  // A second of slack so the job is unambiguously due when we look.
  return Math.max(0, wait) + 1000;
}
