/**
 * POST /api/cron/data-retention
 *
 * Data retention policies plus job-table pruning, for manual runs. On schedule
 * it runs inside the daily step of the gated tick (/api/cron/tick).
 *
 * POST, not GET: a GET can be triggered cross-site by any page an admin happens
 * to open (an <img> tag is enough), riding on their cookies. Protected by
 * CRON_SECRET or a live super-admin session.
 */

import { runRetention } from "@/lib/platform/cron-tick";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function POST(request: Request) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  return Response.json(await runRetention());
}
