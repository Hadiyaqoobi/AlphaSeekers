import { NextRequest, NextResponse } from "next/server";

import { runTick } from "@/lib/platform/cron-tick";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/tick — the ONLY endpoint the Render cron calls, hourly.
 *
 * Decides from the in-memory agenda whether anything is due (a session within
 * the reminder lead, a queued job, the once-a-day work) and runs only that.
 * When nothing is due it answers `{ skipped: true }` without querying the
 * database, so the Neon compute stays suspended for the hour. See
 * `src/lib/platform/cron-tick.ts` and ADR-0008.
 *
 * The cron-secret check is a header compare, so a skipped tick touches nothing.
 * The individual /api/cron/* routes remain for manual runs.
 */
export async function POST(request: NextRequest) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const result = await runTick();
  return NextResponse.json(result);
}
