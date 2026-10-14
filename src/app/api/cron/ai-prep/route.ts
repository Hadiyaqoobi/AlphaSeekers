/**
 * POST /api/cron/ai-prep
 *
 * Sends personalized pre-class prep messages to enrolled students for
 * sessions starting soon. The work lives in src/lib/ai/session/ai-prep.ts
 * (runAiPrep) so the gated cron pulse can call it in-process; this route is a
 * thin, cron-authorized trigger for it.
 */

import { runAiPrep } from "@/lib/ai/session/ai-prep";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function POST(request: Request) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  return Response.json(await runAiPrep());
}
