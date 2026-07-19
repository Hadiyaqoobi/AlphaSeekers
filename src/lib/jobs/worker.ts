/**
 * Job worker: claims due jobs and dispatches them to registered handlers.
 *
 * Runs in two modes off the SAME core (drainOnce):
 *   - As a long-lived Render *worker service* (see scripts/worker.mjs → runWorker).
 *   - As a cron-triggered batch drain (POST /api/cron/worker) for single-service
 *     / free-tier deployments that have no dedicated worker.
 *
 * Handlers are registered in src/lib/jobs/handlers — import that module before
 * draining so the registry is populated.
 */

import { claim, markCompleted, markFailed, reapStalled, type ClaimedJob } from "@/lib/jobs/queue";
import { logger } from "@/lib/observability/logger";
import { reportError } from "@/lib/observability/report";

export type JobContext = { jobId: string; attempt: number };
export type JobHandler = (payload: Record<string, unknown>, ctx: JobContext) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function getRegisteredTypes(): string[] {
  return Array.from(handlers.keys());
}

export type DrainResult = {
  processed: number;
  succeeded: number;
  retried: number;
  deadLettered: number;
};

/**
 * Claim and process up to `batchSize` due jobs. Each job runs its handler; on
 * success it is marked COMPLETED, on throw it retries with backoff or dead-letters.
 * An unknown job type is treated as a failure (so it retries then dead-letters,
 * surfacing the misconfiguration rather than silently vanishing).
 */
export async function drainOnce(opts: { workerId: string; batchSize?: number } = { workerId: "worker" }): Promise<DrainResult> {
  const batchSize = opts.batchSize ?? 10;
  const jobs = await claim(opts.workerId, batchSize);

  const result: DrainResult = { processed: jobs.length, succeeded: 0, retried: 0, deadLettered: 0 };

  for (const job of jobs) {
    const outcome = await runJob(job);
    if (outcome === "ok") result.succeeded += 1;
    else if (outcome === "retry") result.retried += 1;
    else result.deadLettered += 1;
  }

  return result;
}

async function runJob(job: ClaimedJob): Promise<"ok" | "retry" | "dead"> {
  const handler = handlers.get(job.type);
  if (!handler) {
    return markFailed(job, new Error(`No handler registered for job type "${job.type}"`));
  }

  try {
    const payload = (job.payload && typeof job.payload === "object" ? job.payload : {}) as Record<string, unknown>;
    await handler(payload, { jobId: job.id, attempt: job.attempts + 1 });
    await markCompleted(job.id);
    return "ok";
  } catch (error) {
    await reportError(error, { jobId: job.id, type: job.type, attempt: job.attempts + 1 });
    const outcome = await markFailed(job, error);
    if (outcome === "dead") {
      logger.error("job dead-lettered", { jobId: job.id, type: job.type, attempts: job.attempts + 1 });
    }
    return outcome;
  }
}

/**
 * Long-lived worker loop for a dedicated worker service. Polls until `signal`
 * aborts, sleeping `idleMs` when the queue is empty. Reaps stalled jobs
 * periodically so a crashed worker's in-flight jobs get retried.
 */
export async function runWorker(opts: {
  workerId: string;
  batchSize?: number;
  idleMs?: number;
  signal?: AbortSignal;
}): Promise<void> {
  const idleMs = opts.idleMs ?? 2000;
  let sinceReap = 0;

  while (!opts.signal?.aborted) {
    if (sinceReap > 60_000) {
      await reapStalled().catch((e) => console.error("[worker] reap failed", e));
      sinceReap = 0;
    }

    let drained: DrainResult;
    try {
      drained = await drainOnce({ workerId: opts.workerId, batchSize: opts.batchSize });
    } catch (error) {
      console.error("[worker] drain failed", error);
      await sleep(idleMs);
      sinceReap += idleMs;
      continue;
    }

    if (drained.processed === 0) {
      await sleep(idleMs);
      sinceReap += idleMs;
    } else {
      // Keep draining immediately while there is work.
      sinceReap += 50;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
