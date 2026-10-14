/**
 * POST /api/posts/[slug]/view
 *
 * Public, fire-and-forget — count a view of a post.
 *
 * The count is buffered in memory and written in a batch when the database is
 * awake for some other reason (`src/lib/platform/story-views.ts`). Writing it
 * here, per view, woke the Neon database for every signed-out reader even
 * though the story page itself is served from cache.
 *
 * Because it's unauthenticated it must not be abusable to inflate counts:
 * the slug is validated and each client IP is throttled per post, so a single
 * caller can't spin the counter in a loop. Throttled/invalid calls still
 * return the same `{ ok: true }` shape (the client ignores the body).
 */

import { recordStoryView } from "@/lib/platform/story-views";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const SLUG_PATTERN = /^[a-zA-Z0-9_-]{1,250}$/;

// At most a handful of counted views per IP per post per window — enough for
// genuine re-reads, not enough to meaningfully inflate a count.
const VIEW_RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;

  if (!SLUG_PATTERN.test(slug)) {
    return Response.json({ ok: true });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(`postview:${ip}:${slug}`, VIEW_RATE_LIMIT);
  if (!rl.allowed) {
    // Throttled — skip the increment but keep the response shape.
    return Response.json({ ok: true });
  }

  // No database access here. An unknown slug is dropped at flush time.
  recordStoryView(slug);
  return Response.json({ ok: true });
}
