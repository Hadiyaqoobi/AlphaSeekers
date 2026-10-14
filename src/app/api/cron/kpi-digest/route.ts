import { NextRequest, NextResponse } from "next/server";

import { enqueueDailyDigests } from "@/lib/platform/cron-tick";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Enqueue the daily digests, for manual runs. Dedupe keys are bucketed per
 * calendar day so repeated invocations (or manual admin re-runs) on the same
 * day collapse to a single job and never double-send.
 *
 * Two audiences, so separate jobs: the KPI digest is super-admin reporting,
 * while the approvals nudge goes to every admin, since any of them can clear
 * the queue; class health rides along. On schedule they are enqueued by the
 * daily step of the gated tick (/api/cron/tick), so no additional (separately
 * billed) Render cron service is needed.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  return NextResponse.json(await enqueueDailyDigests());
}
