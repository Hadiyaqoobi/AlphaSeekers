import { NextRequest, NextResponse } from "next/server";

import { enqueue } from "@/lib/jobs/queue";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

/**
 * Scheduler cron. Enqueues a `run_scheduler` job so the heavy scheduling fan-out
 * runs in the worker rather than inline in the cron request (ADR-0004). The
 * dedupe key is bucketed per hour so repeated ticks within the hour collapse to
 * a single job.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const bucket = Math.floor(Date.now() / 3600000);
  const { id } = await enqueue(
    "run_scheduler",
    {},
    { dedupeKey: `run_scheduler:${bucket}` },
  );

  return NextResponse.json({ enqueued: id });
}
