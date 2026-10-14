/**
 * Unit tests for the public-page cache.
 *
 * This cache is what lets a signed-out visitor (or a crawler) load the site
 * without waking the Neon database, which is billed by the hours it is awake.
 * The rules that matter are the ones that would embarrass us if they broke: an
 * admin's change must show up at once, a database outage must not blank the
 * front page, and a failure must never be remembered as if it were the answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidatePublicCache,
  readThroughPublicCache,
  refreshPublicCache,
  resetPublicCacheForTests,
} from "@/lib/platform/public-cache";

const HOUR = 60 * 60 * 1000;
/** The default TTL: longer than a day, because the cache is renewed by the DAILY tick. */
const TTL = 26 * HOUR;

describe("public-page cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    delete process.env.PUBLIC_CACHE_TTL_SECONDS;
    resetPublicCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves repeat reads from memory instead of calling the loader again", async () => {
    const load = vi.fn(async () => ["english"]);

    expect(await readThroughPublicCache("landing", "k", load)).toEqual(["english"]);
    expect(await readThroughPublicCache("landing", "k", load)).toEqual(["english"]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps different keys and scopes apart", async () => {
    const a = vi.fn(async () => "a");
    const b = vi.fn(async () => "b");

    expect(await readThroughPublicCache("opportunities", "JOB", a)).toBe("a");
    expect(await readThroughPublicCache("opportunities", "GRANT", b)).toBe("b");
    expect(await readThroughPublicCache("opportunities", "JOB", a)).toBe("a");

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("reloads after a write invalidates the scope", async () => {
    let value = "before";
    const load = vi.fn(async () => value);

    expect(await readThroughPublicCache("settings", "k", load)).toBe("before");

    value = "after";
    invalidatePublicCache("settings");

    expect(await readThroughPublicCache("settings", "k", load)).toBe("after");
  });

  it("does not let an invalidation in one scope evict another", async () => {
    const load = vi.fn(async () => "library");
    await readThroughPublicCache("library", "all", load);

    invalidatePublicCache("stories");
    await readThroughPublicCache("library", "all", load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  // A write inside a transaction invalidates before the commit. A reader that
  // reloads in that gap sees the old rows; they must not be trusted as fresh.
  it("does not trust a value loaded in the moments right after a write", async () => {
    let value = "pre-commit";
    const load = vi.fn(async () => value);

    invalidatePublicCache("landing");
    expect(await readThroughPublicCache("landing", "k", load)).toBe("pre-commit");

    value = "committed";
    vi.advanceTimersByTime(5_000);

    expect(await readThroughPublicCache("landing", "k", load)).toBe("committed");
    // ...and once past the settle window it is cached normally again.
    expect(await readThroughPublicCache("landing", "k", load)).toBe("committed");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("expires an entry after the TTL as a safety net", async () => {
    const load = vi.fn(async () => "v");
    await readThroughPublicCache("webinars", "all", load);

    // A full day later it is still served from memory: there is no hourly
    // refresh any more, and the daily one must find it alive.
    vi.advanceTimersByTime(25 * HOUR);
    await readThroughPublicCache("webinars", "all", load);
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(HOUR + 1);
    await readThroughPublicCache("webinars", "all", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("serves the last good value when the database cannot be reached", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("last good")
      .mockRejectedValue(new Error("compute time quota exceeded"));

    await readThroughPublicCache("landing", "k", load);
    vi.advanceTimersByTime(3 * HOUR);

    expect(await readThroughPublicCache("landing", "k", load)).toBe("last good");
  });

  it("propagates the error, and caches nothing, when there is no earlier value", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue("recovered");

    await expect(readThroughPublicCache("landing", "k", load)).rejects.toThrow("down");
    expect(await readThroughPublicCache("landing", "k", load)).toBe("recovered");
  });

  it("shares one load between visitors who arrive together on a cold cache", async () => {
    let release: (value: string) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const first = readThroughPublicCache("landing", "k", load);
    const second = readThroughPublicCache("landing", "k", load);
    release("once");

    expect(await first).toBe("once");
    expect(await second).toBe("once");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("never keeps a result the caller says is uncacheable, and drops the old one", async () => {
    let story: { title: string } | null = { title: "published" };
    const load = vi.fn(async () => story);
    const read = () =>
      readThroughPublicCache("stories", "post:slug", load, {
        shouldCache: (value) => value !== null,
      });

    expect(await read()).toEqual({ title: "published" });

    // Unpublished: the write invalidates, the reload finds nothing.
    story = null;
    invalidatePublicCache("stories");
    vi.advanceTimersByTime(5_000);
    expect(await read()).toBeNull();

    // The old entry is gone, so even a failing database cannot resurrect it.
    load.mockRejectedValueOnce(new Error("down"));
    await expect(read()).rejects.toThrow("down");
  });

  it("refresh re-runs every cached loader so entries never age out between daily ticks", async () => {
    let value = "old";
    const load = vi.fn(async () => value);
    await readThroughPublicCache("landing", "k", load);

    value = "new";
    vi.advanceTimersByTime(24 * HOUR);
    expect(await refreshPublicCache()).toEqual({ refreshed: 1, failed: 0 });

    // The next daily tick is 24h after this refresh and 48h after the first
    // load: past the TTL of the original entry, but the refreshed one is good.
    vi.advanceTimersByTime(24 * HOUR);
    expect(TTL).toBeGreaterThan(24 * HOUR);
    expect(await readThroughPublicCache("landing", "k", load)).toBe("new");
    expect(load).toHaveBeenCalledTimes(2);
  });

  // The database is awake because of the write; rebuilding the entry then is
  // free, while leaving it to the next visitor could mean waking it again.
  it("re-loads an invalidated scope by itself a few seconds after the write", async () => {
    let value = "before";
    const load = vi.fn(async () => value);
    await readThroughPublicCache("landing", "k", load);

    value = "after";
    invalidatePublicCache("landing");
    expect(load).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(6_000);
    expect(load).toHaveBeenCalledTimes(2);

    // The visitor who comes next is served from memory, with the new value.
    expect(await readThroughPublicCache("landing", "k", load)).toBe("after");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("runs one reload for a burst of writes, after the last one has settled", async () => {
    const landing = vi.fn(async () => "landing");
    const library = vi.fn(async () => "library");
    await readThroughPublicCache("landing", "k", landing);
    await readThroughPublicCache("library", "all", library);

    invalidatePublicCache("landing");
    await vi.advanceTimersByTimeAsync(4_000);
    invalidatePublicCache("landing");
    await vi.advanceTimersByTimeAsync(5_000);
    expect(landing).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(landing).toHaveBeenCalledTimes(2);
    // Other scopes are not touched.
    expect(library).toHaveBeenCalledTimes(1);
  });

  it("a failing post-write reload keeps the old value and does not throw", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("kept")
      .mockRejectedValue(new Error("down"));
    await readThroughPublicCache("webinars", "all", load);

    invalidatePublicCache("webinars");
    await vi.advanceTimersByTimeAsync(6_000);

    expect(load).toHaveBeenCalledTimes(2);
    expect(await readThroughPublicCache("webinars", "all", load)).toBe("kept");
  });

  it("caches a null result (a missing story or class) unless told not to", async () => {
    const load = vi.fn(async () => null);

    expect(await readThroughPublicCache("stories", "post:nope", load)).toBeNull();
    expect(await readThroughPublicCache("stories", "post:nope", load)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("refresh keeps the old value for a loader that fails, and carries on", async () => {
    const good = vi.fn(async () => "good");
    const bad = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("kept")
      .mockRejectedValue(new Error("down"));

    await readThroughPublicCache("library", "all", bad);
    await readThroughPublicCache("webinars", "all", good);

    expect(await refreshPublicCache()).toEqual({ refreshed: 1, failed: 1 });
    expect(await readThroughPublicCache("library", "all", bad)).toBe("kept");
  });

  it("caps the number of entries so URL-derived keys cannot grow it without bound", async () => {
    const first = vi.fn(async () => "first");
    await readThroughPublicCache("stories", "post:first", first);

    for (let i = 0; i < 200; i += 1) {
      await readThroughPublicCache("stories", `post:${i}`, async () => i);
    }

    await readThroughPublicCache("stories", "post:first", first);
    expect(first).toHaveBeenCalledTimes(2);
  });

  it("can be switched off with PUBLIC_CACHE_TTL_SECONDS=0", async () => {
    process.env.PUBLIC_CACHE_TTL_SECONDS = "0";
    const load = vi.fn(async () => "v");

    await readThroughPublicCache("landing", "k", load);
    await readThroughPublicCache("landing", "k", load);

    expect(load).toHaveBeenCalledTimes(2);
    delete process.env.PUBLIC_CACHE_TTL_SECONDS;
  });
});
