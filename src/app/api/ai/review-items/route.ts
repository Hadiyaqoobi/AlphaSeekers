/**
 * GET  /api/ai/review-items      — items due for review
 * POST /api/ai/review-items      — record review result (body: { itemId, quality })
 */

import { getSessionUser, unauthorized, badRequest } from "@/lib/security/session";
import { getDueItems, recordReview } from "@/lib/ai/learning/spaced-repetition";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const items = await getDueItems(user.id);
  return Response.json({ items, count: items.length });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.itemId || typeof body.quality !== "number") {
    return badRequest("Required: itemId (string), quality (0-5)");
  }

  const result = await recordReview(body.itemId, body.quality);
  return Response.json(result);
}
