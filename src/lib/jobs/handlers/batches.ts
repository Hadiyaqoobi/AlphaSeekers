/**
 * Batch job handlers.
 *
 * These wrap the platform's existing batch routines so they can be driven by the
 * durable queue (enqueued by a scheduler/cron). Each simply delegates and lets
 * any error propagate — the queue then retries with backoff.
 */

import { runReminderBatch, runSchedulerBatch } from "@/lib/platform/store";

/** "run_reminders" — send the due reminder batch. Throws to retry on failure. */
export async function runReminders(): Promise<void> {
  await runReminderBatch();
}

/** "run_scheduler" — advance the scheduler batch. Throws to retry on failure. */
export async function runScheduler(): Promise<void> {
  await runSchedulerBatch();
}
