import { NextRequest, NextResponse } from "next/server";

import { enqueue } from "@/lib/jobs/queue";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

/**
 * Reminder cron. Rather than running the heavy reminder fan-out inline in the
 * request (which would tie up the cron request and risk timeouts), we enqueue a
 * `run_reminders` job and let the worker do the work (ADR-0004). The dedupe key
 * is bucketed into 10-minute windows so overlapping cron ticks collapse to one job.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const bucket = Math.floor(Date.now() / 600000);
  const { id } = await enqueue(
    "run_reminders",
    {},
    { dedupeKey: `run_reminders:${bucket}` },
  );

  return NextResponse.json({ enqueued: id });
}
