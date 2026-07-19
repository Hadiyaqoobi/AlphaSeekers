/**
 * GET /api/cron/data-retention
 *
 * Daily cron job to enforce data retention policies.
 * Protected by CRON_SECRET.
 */

import { enforceRetentionPolicies } from "@/lib/ai/privacy/data-retention";
import { pruneJobs } from "@/lib/jobs/queue";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function GET(request: Request) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const result = await enforceRetentionPolicies();

  // Also bound job-queue growth: prune terminal (COMPLETED/DEAD) jobs older than
  // 14 days, which frees their retained dedupeKeys too.
  const jobsPruned = await pruneJobs(14);

  return Response.json({ ...result, jobsPruned });
}
