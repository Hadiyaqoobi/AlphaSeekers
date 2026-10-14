import { NextRequest, NextResponse } from "next/server";

import { enqueueSchedulerRun } from "@/lib/platform/cron-tick";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

/**
 * Scheduler cron, for manual runs. Enqueues a `run_scheduler` job so the heavy
 * scheduling fan-out runs in the worker rather than inline in the request
 * (ADR-0004). The dedupe key is bucketed per hour so repeated runs within the
 * hour collapse to a single job.
 *
 * On schedule this runs from the gated tick (/api/cron/tick) once a day, and
 * hourly only while a pass over many classes is unfinished.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const { id } = await enqueueSchedulerRun();

  return NextResponse.json({ enqueued: id });
}
