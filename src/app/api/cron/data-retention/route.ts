/**
 * GET /api/cron/data-retention
 *
 * Daily cron job to enforce data retention policies.
 * Protected by CRON_SECRET.
 */

import { enforceRetentionPolicies } from "@/lib/ai/privacy/data-retention";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function GET(request: Request) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const result = await enforceRetentionPolicies();
  return Response.json(result);
}
