import { NextRequest, NextResponse } from "next/server";

import { drainQueue } from "@/lib/platform/cron-tick";
import { refreshPublicCache } from "@/lib/platform/public-cache";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Worker drain, for manual runs. On schedule the gated tick (/api/cron/tick)
 * drains the queue in-process whenever it runs; this route is the "drain it now"
 * button. It drains up to ~5 batches (stopping early once a drain finds
 * nothing) so one invocation clears a meaningful chunk of backlog.
 *
 * It also renews the public-page cache: the database is awake for the drain,
 * which makes this a moment a refresh costs nothing. See
 * `src/lib/platform/public-cache.ts`.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const totals = await drainQueue();

  // Fail-soft per entry, so this cannot fail the drain it rides on.
  const publicCache = await refreshPublicCache();

  return NextResponse.json({ ...totals, publicCache });
}
