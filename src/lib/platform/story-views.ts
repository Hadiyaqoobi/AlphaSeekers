/**
 * Story view counts, buffered in memory and written in batches.
 *
 * Why: every Student Voices page view used to run
 * `studentPost.update({ viewCount: increment })` straight away. The story page
 * itself is served from the public cache without touching the database, but the
 * view beacon then woke Neon anyway, and Neon bills by the hours it is awake.
 * A count that is a few hours late costs nobody anything; a wake per reader does.
 *
 * Views are counted here and written by `flushStoryViews()`, which runs only
 * when the database is awake for some other reason: at the end of every gated
 * cron tick (always including the daily one) and whenever the tick agenda is
 * refreshed after a write (`src/lib/platform/agenda.ts`).
 *
 * Accepted loss: views counted since the last flush are lost if the process
 * restarts (a deploy). They are a popularity signal, not a record.
 *
 * Likes are NOT buffered: they belong to a signed-in person who expects their
 * own click to stick, and the database is awake for them anyway.
 */
import { prisma } from "@/lib/prisma";

/**
 * Cap on distinct slugs held between flushes. Slugs come from the URL, so an
 * unbounded map would let a script grow memory with made-up ones. Real
 * stories number in the tens; past the cap new slugs are simply not counted.
 */
const MAX_PENDING_SLUGS = 500;

declare global {
  // eslint-disable-next-line no-var
  var alphaseekersStoryViews: Map<string, number> | undefined;
}

// On globalThis for the same reason as the public cache: route handlers and
// the cron tick are bundled separately and must share one buffer.
function pending(): Map<string, number> {
  if (!globalThis.alphaseekersStoryViews) {
    globalThis.alphaseekersStoryViews = new Map();
  }
  return globalThis.alphaseekersStoryViews;
}

/** Count one view. Never touches the database. */
export function recordStoryView(slug: string): void {
  const views = pending();
  const current = views.get(slug);
  if (current === undefined && views.size >= MAX_PENDING_SLUGS) return;
  views.set(slug, (current ?? 0) + 1);
}

/** How many views are waiting to be written (diagnostics and tests). */
export function pendingStoryViewCount(): number {
  let total = 0;
  for (const count of Array.from(pending().values())) total += count;
  return total;
}

/**
 * Write the buffered counts. Call only when the database is already awake.
 * Never throws: a failed write puts its count back for the next flush.
 *
 * `updateMany` rather than `update` so a slug that no longer exists (or never
 * did) is a no-op instead of an error. The Prisma extension recognises an
 * update that only touches `viewCount` and does not invalidate the public
 * story cache for it (`src/lib/prisma.ts`).
 */
export async function flushStoryViews(): Promise<{ written: number; failed: number }> {
  const views = pending();
  if (views.size === 0) return { written: 0, failed: 0 };

  const batch = Array.from(views.entries());
  views.clear();

  let written = 0;
  let failed = 0;
  for (const [slug, count] of batch) {
    try {
      await prisma.studentPost.updateMany({
        where: { slug },
        data: { viewCount: { increment: count } },
      });
      written += count;
    } catch {
      failed += count;
      views.set(slug, (views.get(slug) ?? 0) + count);
    }
  }
  return { written, failed };
}

/** Test seam. */
export function resetStoryViewsForTests(): void {
  globalThis.alphaseekersStoryViews = undefined;
}
