import { NextRequest, NextResponse } from "next/server";

import { enqueueReminderRun } from "@/lib/platform/cron-tick";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

/**
 * Reminder cron, for manual runs. Rather than running the heavy reminder
 * fan-out inline in the request (which would tie up the request and risk
 * timeouts), we enqueue a `run_reminders` job and let the worker do the work
 * (ADR-0004). The dedupe key is bucketed into 10-minute windows so overlapping
 * runs collapse to one job.
 *
 * On schedule this runs from the gated tick (/api/cron/tick), only in hours
 * with a session coming up.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const { id } = await enqueueReminderRun();

  return NextResponse.json({ enqueued: id });
}
