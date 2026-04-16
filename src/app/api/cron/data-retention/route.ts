/**
 * GET /api/cron/data-retention
 *
 * Daily cron job to enforce data retention policies.
 * Protected by CRON_SECRET.
 */

import { enforceRetentionPolicies } from "@/lib/ai/privacy/data-retention";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await enforceRetentionPolicies();
  return Response.json(result);
}
