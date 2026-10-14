/**
 * In-process read cache for what SIGNED-OUT visitors see.
 *
 * Why this exists: the database is Neon serverless Postgres, which is billed by
 * the hours its compute is awake and suspends after five idle minutes. Every
 * public page used to query it on every request, so one crawler fetching the
 * landing page woke the database and kept it awake for five more minutes. Enough
 * strangers and it never slept at all.
 *
 * With this cache a stranger's page view is served from memory and the database
 * stays asleep. It is deliberately NOT the source of truth for anything, and it
 * is only ever read by public, non-personalised pages.
 *
 * How it stays correct:
 *   - Every write to a model a public page shows invalidates the matching scope,
 *     automatically, from one Prisma extension (`src/lib/prisma.ts`). No call
 *     site has to remember to do it.
 *   - The hourly cron pulse re-runs every cached loader while the database is
 *     already awake for the queue (`refreshPublicCache`), so entries are replaced
 *     before they expire and time-based changes show up within the hour.
 *   - The TTL is only a safety net for changes this process cannot see: a row
 *     edited by hand in the Neon console, or a write handled by another instance.
 *
 * KNOWN LIMIT: the cache is per process. The app runs as a single web instance
 * today. With more than one, a write invalidates only the instance that handled
 * it and the others stay stale until their next hourly refresh. Move this to a
 * shared store before scaling out.
 */

export type PublicScope =
  | "settings"
  | "landing"
  | "library"
  | "webinars"
  | "opportunities"
  | "stories";

type Entry = {
  value: unknown;
  loadedAt: number;
  scope: PublicScope;
  load: () => Promise<unknown>;
  shouldCache?: (value: never) => boolean;
};

type ReadOptions<T> = {
  /**
   * Return false for a result that must not be kept, such as "no such story".
   * The result is still returned to the caller, and any older entry under the
   * same key is dropped so a story that was unpublished stops being served.
   */
  shouldCache?: (value: T) => boolean;
};

type CacheState = {
  entries: Map<string, Entry>;
  /** Per scope: entries loaded before this instant are not trusted. */
  staleBefore: Map<PublicScope, number>;
  inflight: Map<string, Promise<unknown>>;
};

/** Longer than the hourly refresh, so a refreshed entry never expires in between. */
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * A write invalidates its scope until slightly AFTER it happened, not just up to
 * it. Writes often run inside a transaction: a reader that re-loads between the
 * write and the commit would otherwise cache the pre-commit rows as fresh.
 */
const SETTLE_MS = 3_000;

/** Story pages are keyed by slug; cap the map so it cannot grow without bound. */
const MAX_ENTRIES = 200;

declare global {
  // eslint-disable-next-line no-var
  var alphaseekersPublicCache: CacheState | undefined;
}

// Held on globalThis rather than in a module variable: Next bundles pages and
// route handlers separately, and a write in an API route has to invalidate what
// a page render cached.
function state(): CacheState {
  if (!globalThis.alphaseekersPublicCache) {
    globalThis.alphaseekersPublicCache = {
      entries: new Map(),
      staleBefore: new Map(),
      inflight: new Map(),
    };
  }
  return globalThis.alphaseekersPublicCache;
}

/** `PUBLIC_CACHE_TTL_SECONDS=0` switches the cache off entirely. */
function ttlMs(): number {
  const raw = process.env.PUBLIC_CACHE_TTL_SECONDS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_TTL_MS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_TTL_MS;
  return seconds * 1000;
}

function isFresh(entry: Entry, now: number, ttl: number): boolean {
  const staleBefore = state().staleBefore.get(entry.scope) ?? 0;
  return now - entry.loadedAt < ttl && entry.loadedAt >= staleBefore;
}

function store(key: string, entry: Entry) {
  const { entries } = state();
  // Re-insert so the map's insertion order doubles as least-recently-loaded.
  entries.delete(key);
  entries.set(key, entry);
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

async function loadAndStore<T>(
  cacheKey: string,
  scope: PublicScope,
  load: () => Promise<T>,
  shouldCache?: (value: T) => boolean,
): Promise<T> {
  const { inflight } = state();

  // One load per key at a time: a burst of visitors on a cold cache shares a
  // single query instead of each opening their own.
  const pending = inflight.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const startedAt = Date.now();
  const promise = (async () => {
    const value = await load();
    if (shouldCache && !shouldCache(value)) {
      state().entries.delete(cacheKey);
      return value;
    }
    // Stamped with when the load STARTED, so a write that lands while the query
    // is in flight still marks this result stale.
    store(cacheKey, {
      value,
      loadedAt: startedAt,
      scope,
      load,
      shouldCache: shouldCache as Entry["shouldCache"],
    });
    return value;
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}

/**
 * Return the cached value for `scope:key`, loading it when missing or stale.
 *
 * If the load fails and an older value exists, the older value is returned: a
 * public page showing an hour-old class list beats one that errors because the
 * database is unreachable. With nothing cached the error propagates, and a
 * failure is never stored.
 *
 * Cached values are shared between requests. Callers must not mutate them.
 */
export async function readThroughPublicCache<T>(
  scope: PublicScope,
  key: string,
  load: () => Promise<T>,
  options: ReadOptions<T> = {},
): Promise<T> {
  const ttl = ttlMs();
  if (ttl === 0) return load();

  const cacheKey = `${scope}:${key}`;
  const existing = state().entries.get(cacheKey);
  if (existing && isFresh(existing, Date.now(), ttl)) {
    return existing.value as T;
  }

  try {
    return await loadAndStore(cacheKey, scope, load, options.shouldCache);
  } catch (error) {
    if (existing) return existing.value as T;
    throw error;
  }
}

/** Mark everything in `scope` stale. Called by the Prisma extension on a write. */
export function invalidatePublicCache(scope: PublicScope): void {
  state().staleBefore.set(scope, Date.now() + SETTLE_MS);
}

/**
 * Re-run every cached loader. Called from the hourly cron pulse while the
 * database is awake anyway, so that entries are renewed on our schedule and a
 * stranger's request never has to wake the database to renew one.
 *
 * Fail-soft per entry: one failing loader keeps its old value and does not stop
 * the rest.
 */
export async function refreshPublicCache(): Promise<{ refreshed: number; failed: number }> {
  let refreshed = 0;
  let failed = 0;

  for (const [cacheKey, entry] of Array.from(state().entries)) {
    try {
      await loadAndStore(
        cacheKey,
        entry.scope,
        entry.load,
        entry.shouldCache as ((value: unknown) => boolean) | undefined,
      );
      refreshed += 1;
    } catch {
      failed += 1;
    }
  }

  return { refreshed, failed };
}

/** Test seam: drop everything, including invalidation marks. */
export function resetPublicCacheForTests(): void {
  globalThis.alphaseekersPublicCache = undefined;
}
