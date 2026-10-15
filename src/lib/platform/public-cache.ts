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
 *   - A few seconds after an invalidation the scope's entries are re-loaded
 *     (`scheduleScopeReload`). The database is awake at that moment because of
 *     the write, so the reload is free; waiting for the next visitor instead
 *     could mean waking it again later.
 *   - The daily cron tick re-runs every cached loader (`refreshPublicCache`).
 *     There is no longer an hourly pulse to do this (ADR-0008), which is why the
 *     TTL is 26 hours: longer than a day, so a refreshed entry never expires
 *     between two daily ticks and a stranger never has to wake the database.
 *   - The TTL is only a safety net for changes this process cannot see: a row
 *     edited by hand in the Neon console, or a write handled by another instance.
 *     Those can take up to a day to appear; a redeploy clears the cache at once.
 *
 * KNOWN LIMIT: the cache is per process. The app runs as a single web instance
 * today. With more than one, a write invalidates only the instance that handled
 * it and the others stay stale until their next daily refresh. Move this to a
 * shared store before scaling out.
 */

export type PublicScope =
  | "settings"
  | "landing"
  | "library"
  | "webinars"
  | "opportunities"
  | "stories"
  | "certificates";

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
  /** Per scope: the pending post-write reload, so a burst of writes runs one. */
  reloadTimers: Map<PublicScope, ReturnType<typeof setTimeout>>;
};

/** Longer than a day, so an entry renewed by the daily tick never expires in between. */
const DEFAULT_TTL_MS = 26 * 60 * 60 * 1000;

/**
 * A write invalidates its scope until slightly AFTER it happened, not just up to
 * it. Writes often run inside a transaction: a reader that re-loads between the
 * write and the commit would otherwise cache the pre-commit rows as fresh.
 */
const SETTLE_MS = 3_000;

/**
 * How long after a write its scope is re-loaded. Must be past SETTLE_MS, or the
 * reloaded value would itself be stamped inside the untrusted window and thrown
 * away; and past Prisma's default interactive-transaction timeout (5s), so a
 * write made inside a transaction has committed (or rolled back) by the time the
 * reload reads. Short enough that the database is still awake from the write.
 */
const RELOAD_AFTER_WRITE_MS = 6_000;

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
      reloadTimers: new Map(),
    };
  }
  // A state object left by an older build (dev hot reload) predates this field.
  globalThis.alphaseekersPublicCache.reloadTimers ??= new Map();
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

/**
 * Mark everything in `scope` stale. Called by the Prisma extension on a write.
 * Also schedules a reload of the scope's entries, see `scheduleScopeReload`.
 */
export function invalidatePublicCache(scope: PublicScope): void {
  state().staleBefore.set(scope, Date.now() + SETTLE_MS);
  scheduleScopeReload(scope);
}

/**
 * Re-load every entry in `scope` shortly after a write, while the write has the
 * database awake. Without this, the first stranger to open the page after the
 * database went back to sleep would wake it again just to rebuild the entry.
 *
 * Debounced per scope (a burst of writes, such as an import, runs one reload,
 * timed from the last write). Runs only once the settle window has passed, so
 * the values it stores are trusted. Never throws, and the timer does not keep
 * the process alive.
 */
function scheduleScopeReload(scope: PublicScope): void {
  if (ttlMs() === 0) return;
  const { reloadTimers } = state();
  const existing = reloadTimers.get(scope);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    state().reloadTimers.delete(scope);
    // A later write may have pushed the settle window past this timer.
    const staleBefore = state().staleBefore.get(scope) ?? 0;
    if (Date.now() < staleBefore) {
      scheduleScopeReload(scope);
      return;
    }
    void reloadScope(scope).catch(() => undefined);
  }, RELOAD_AFTER_WRITE_MS);
  timer.unref?.();
  reloadTimers.set(scope, timer);
}

async function reloadScope(scope: PublicScope): Promise<void> {
  for (const [cacheKey, entry] of Array.from(state().entries)) {
    if (entry.scope !== scope) continue;
    try {
      await loadAndStore(
        cacheKey,
        entry.scope,
        entry.load,
        entry.shouldCache as ((value: unknown) => boolean) | undefined,
      );
    } catch {
      // Keep the old value; the next reader or the daily refresh tries again.
    }
  }
}

/**
 * Re-run every cached loader. Called from the daily cron tick (and the manual
 * worker route) while the database is awake anyway, so that entries are renewed
 * on our schedule and a stranger's request never has to wake the database to
 * renew one.
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
  const current = globalThis.alphaseekersPublicCache;
  if (current) {
    for (const timer of Array.from(current.reloadTimers.values())) clearTimeout(timer);
  }
  globalThis.alphaseekersPublicCache = undefined;
}
