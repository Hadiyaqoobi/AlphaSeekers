import { NextRequest, NextResponse } from "next/server";

import { registerAllHandlers } from "@/lib/jobs/handlers";
import { reapStalled } from "@/lib/jobs/queue";
import { drainOnce } from "@/lib/jobs/worker";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Cron-triggered worker drain. For single-service / free-tier deployments that
 * have no dedicated worker process, a per-minute cron hits this route to make
 * real progress on the queue. We drain up to ~5 batches (stopping early once a
 * drain finds nothing) so one invocation clears a meaningful chunk of backlog.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  // Populate the handler registry before draining.
  registerAllHandlers();

  // Recover jobs orphaned in ACTIVE by a worker that died mid-flight (deploy,
  // OOM, runtime cap) — the cron-drain topology has no long-running loop to do
  // this, so a job would otherwise be stuck ACTIVE (and never retried) forever.
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

  return NextResponse.json(totals);
}
