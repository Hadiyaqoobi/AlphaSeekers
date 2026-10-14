/**
 * The scheduled work, as plain functions, and the gated hourly tick that runs it.
 *
 * Each step used to live only inside its own /api/cron/* route, and the Render
 * pulse curled every route every hour. Every one of those calls queried the
 * database, so the database woke 24 times a day even when nothing was due.
 *
 * Now the steps live here. The individual routes still call them (manual runs
 * and the admin "run now" buttons keep working), and `runTick` calls them
 * in-process, but only when the in-memory agenda says something is due
 * (`src/lib/platform/agenda.ts`). When nothing is, the tick returns without a
 * single query and the database stays asleep. See
 * docs/adr/0008-only-wake-the-database-when-something-is-due.md.
 */
import { enforceRetentionPolicies } from "@/lib/ai/privacy/data-retention";
import { runAiPrep } from "@/lib/ai/session/ai-prep";
import { registerAllHandlers } from "@/lib/jobs/handlers";
import { enqueue, pruneJobs, reapStalled } from "@/lib/jobs/queue";
import { drainOnce } from "@/lib/jobs/worker";
import {
  beginTick,
  endTick,
  getAgenda,
  markDailyRan,
  planTick,
  refreshAgenda,
  utcDay,
  type TickReason,
} from "@/lib/platform/agenda";
import { refreshPublicCache } from "@/lib/platform/public-cache";
import { flushStoryViews } from "@/lib/platform/story-views";

// ─── Steps (shared with the individual cron routes) ─────────────────────────

/**
 * Enqueue a `run_reminders` job; the worker does the fan-out (ADR-0004). The
 * dedupe key is bucketed into 10-minute windows so overlapping runs collapse.
 */
export async function enqueueReminderRun(now: number = Date.now()) {
  const bucket = Math.floor(now / 600000);
  return enqueue("run_reminders", {}, { dedupeKey: `run_reminders:${bucket}` });
}

/**
 * Enqueue a `run_scheduler` job (ADR-0004). Bucketed per hour so repeated runs
 * within the hour collapse to one job.
 */
export async function enqueueSchedulerRun(now: number = Date.now()) {
  const bucket = Math.floor(now / 3600000);
  return enqueue("run_scheduler", {}, { dedupeKey: `run_scheduler:${bucket}` });
}

/**
 * Data retention, plus bounding the job table: prune terminal (COMPLETED/DEAD)
 * jobs older than 14 days, which frees their retained dedupe keys too.
 */
export async function runRetention() {
  const result = await enforceRetentionPolicies();
  const jobsPruned = await pruneJobs(14);
  return { ...result, jobsPruned };
}

/**
 * Enqueue the daily digests. Dedupe keys are bucketed per UTC day so repeated
 * runs on the same day collapse to one job each and never double-send.
 *
 * Separate jobs because the audiences differ: the KPI digest is super-admin
 * reporting, the approvals nudge goes to every admin, and class health to the
 * people who run classes.
 *
 * The `kpi_digest:<day>` key doubles as the durable "daily work ran today"
 * marker the agenda reads after a restart (`loadAgenda`).
 */
export async function enqueueDailyDigests(now: number = Date.now()) {
  const day = utcDay(now);

  const kpi = await enqueue("kpi_digest", {}, { dedupeKey: `kpi_digest:${day}` });
  const approvals = await enqueue(
    "pending_approvals_digest",
    {},
    { dedupeKey: `pending_approvals_digest:${day}` },
  );
  const health = await enqueue(
    "class_health_digest",
    {},
    { dedupeKey: `class_health_digest:${day}` },
  );

  return {
    kpiDigest: { enqueued: kpi.id, deduped: kpi.deduped },
    pendingApprovals: { enqueued: approvals.id, deduped: approvals.deduped },
    classHealth: { enqueued: health.id, deduped: health.deduped },
  };
}

/**
 * Drain the job queue: reap jobs orphaned in ACTIVE by a worker that died
 * mid-flight, then up to 5 batches of 25, stopping early once a batch finds
 * nothing.
 */
export async function drainQueue() {
  // Populate the handler registry before draining.
  registerAllHandlers();

  // The cron-drain topology has no long-running loop to recover a job stuck in
  // ACTIVE after a deploy, OOM or runtime cap; without this it would never retry.
  const reaped = await reapStalled();

  const totals = { processed: 0, succeeded: 0, retried: 0, deadLettered: 0, reaped };

  for (let i = 0; i < 5; i += 1) {
    const result = await drainOnce({ workerId: "cron-worker", batchSize: 25 });
    totals.processed += result.processed;
    totals.succeeded += result.succeeded;
    totals.retried += result.retried;
    totals.deadLettered += result.deadLettered;
    if (result.processed === 0) break;
  }

  return totals;
}

// ─── The gated tick ─────────────────────────────────────────────────────────

export type TickResult =
  | { skipped: true; busy?: true }
  | { skipped: false; reasons: TickReason[]; steps: Record<string, unknown> };

/** Run one step fail-soft: an error is reported in the result and the tick goes on. */
async function step(
  steps: Record<string, unknown>,
  name: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    steps[name] = await fn();
  } catch (error) {
    console.error(`[cron-tick] step ${name} failed:`, error);
    steps[name] = { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The hourly tick. Called by the one Render cron through POST /api/cron/tick.
 *
 * When `planTick` says nothing is due, returns `{ skipped: true }` having made
 * NO database query. Otherwise runs, in the same order the old pulse did (each
 * step can feed the next, e.g. a digest enqueued here is sent by the drain
 * below rather than an hour later):
 *
 *   session soon → enqueue reminders
 *   daily / scheduler mid-pass → enqueue scheduler
 *   session soon → AI prep
 *   daily → data retention, then the digests
 *   always → drain the queue
 *   daily → renew the public-page cache
 *   always → flush buffered story views, reload the agenda
 */
export async function runTick(now: Date = new Date()): Promise<TickResult> {
  const nowMs = now.getTime();
  const first = planTick(getAgenda(), nowMs);
  if (!first.run) return { skipped: true };

  if (!beginTick()) return { skipped: true, busy: true };

  try {
    const reasons = new Set<TickReason>(first.reasons);
    let sessionWork = first.sessionWork;
    let scheduler = first.scheduler;
    let daily = first.daily;

    if (first.needsAgenda) {
      // The database is about to be woken anyway; learn what is actually due.
      const agenda = await refreshAgenda();
      if (agenda) {
        const second = planTick(agenda, nowMs);
        second.reasons.forEach((reason) => reasons.add(reason));
        sessionWork = second.sessionWork;
        scheduler = second.scheduler;
        daily = second.daily;
      } else {
        // Could not read it. Err towards sending reminders rather than not.
        sessionWork = true;
      }
    }

    // Marked before running, so an overlapping or retried tick does not start
    // the day's work again while this one is still at it.
    if (daily) markDailyRan(utcDay(nowMs));

    const steps: Record<string, unknown> = {};

    if (sessionWork) await step(steps, "reminders", () => enqueueReminderRun(nowMs));
    if (scheduler) await step(steps, "scheduler", () => enqueueSchedulerRun(nowMs));
    if (sessionWork) await step(steps, "aiPrep", () => runAiPrep(now));
    if (daily) {
      await step(steps, "dataRetention", () => runRetention());
      await step(steps, "digests", () => enqueueDailyDigests(nowMs));
    }
    await step(steps, "worker", () => drainQueue());
    if (daily) await step(steps, "publicCache", () => refreshPublicCache());
    await step(steps, "storyViews", () => flushStoryViews());
    await step(steps, "agenda", async () => {
      const agenda = await refreshAgenda();
      return agenda
        ? { loaded: true, sessions: agenda.sessionStarts.length, nextJobAt: agenda.nextJobAt }
        : { loaded: false };
    });

    return { skipped: false, reasons: Array.from(reasons), steps };
  } finally {
    endTick();
  }
}
