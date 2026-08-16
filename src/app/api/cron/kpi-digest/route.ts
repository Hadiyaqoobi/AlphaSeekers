import { NextRequest, NextResponse } from "next/server";

import { enqueue } from "@/lib/jobs/queue";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Enqueue the daily digests. Dedupe keys are bucketed per calendar day so
 * repeated cron invocations (or manual admin re-runs) on the same day collapse
 * to a single job and never double-send.
 *
 * Two separate jobs rather than one because they have different audiences: the
 * KPI digest is super-admin reporting, while the approvals nudge goes to every
 * admin, since any of them can clear the queue. They ride the same daily tick so
 * no additional (separately billed) Render cron service is needed.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const day = new Date().toISOString().slice(0, 10);

  const kpi = await enqueue("kpi_digest", {}, { dedupeKey: `kpi_digest:${day}` });
  const approvals = await enqueue(
    "pending_approvals_digest",
    {},
    { dedupeKey: `pending_approvals_digest:${day}` },
  );

  return NextResponse.json({
    kpiDigest: { enqueued: kpi.id, deduped: kpi.deduped },
    pendingApprovals: { enqueued: approvals.id, deduped: approvals.deduped },
  });
}
