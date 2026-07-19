import { NextRequest, NextResponse } from "next/server";

import { enqueue } from "@/lib/jobs/queue";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Enqueue the daily KPI digest. The dedupe key is bucketed per calendar day so
 * repeated cron invocations (or manual admin re-runs) on the same day collapse
 * to a single job and never double-send the digest.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const day = new Date().toISOString().slice(0, 10);
  const { id, deduped } = await enqueue(
    "kpi_digest",
    {},
    { dedupeKey: `kpi_digest:${day}` },
  );

  return NextResponse.json({ enqueued: id, deduped });
}
