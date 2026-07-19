/**
 * Handler registry.
 *
 * `registerAllHandlers()` wires every job type to its handler in the worker's
 * registry. Import and call it before draining the queue (from the worker
 * service and the cron worker route). It is idempotent — safe to call on every
 * request / loop iteration; re-registering just re-sets the same map entries.
 */

import { registerHandler } from "@/lib/jobs/worker";

import { runReminders, runScheduler } from "./batches";
import { kpiDigest } from "./digest";
import {
  notifyHomeworkSubmitted,
  notifyModerationQueued,
  sendNotification,
  sessionReminder,
  welcomeEmployee,
  welcomeStudent,
} from "./notifications";

/** Every job type wired up by `registerAllHandlers`, for reference/diagnostics. */
export const REGISTERED_JOB_TYPES: string[] = [
  "send_notification",
  "welcome_student",
  "welcome_employee",
  "session_reminder",
  "notify_homework_submitted",
  "notify_moderation_queued",
  "run_reminders",
  "run_scheduler",
  "kpi_digest",
];

let registered = false;

export function registerAllHandlers(): void {
  // The worker registry is a Map, so re-registering is already idempotent; this
  // flag just avoids redundant Map writes on hot paths.
  if (registered) return;

  registerHandler("send_notification", sendNotification);
  registerHandler("welcome_student", welcomeStudent);
  registerHandler("welcome_employee", welcomeEmployee);
  registerHandler("session_reminder", sessionReminder);
  registerHandler("notify_homework_submitted", notifyHomeworkSubmitted);
  registerHandler("notify_moderation_queued", notifyModerationQueued);
  registerHandler("run_reminders", runReminders);
  registerHandler("run_scheduler", runScheduler);
  registerHandler("kpi_digest", kpiDigest);

  registered = true;
}
