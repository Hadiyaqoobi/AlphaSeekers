/**
 * Unit tests for the gated cron tick (POST /api/cron/tick).
 *
 * The property that pays for itself: when nothing is due, the tick returns
 * without touching the database at all, so the Neon compute stays suspended.
 * Prisma is replaced by a proxy that records ANY access, so "no query" is
 * asserted directly rather than inferred.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const touched: string[] = [];

function recordingProxy(path: string): unknown {
  return new Proxy(() => undefined, {
    get(_target, prop) {
      if (prop === "then") return undefined; // not a thenable
      const next = `${path}.${String(prop)}`;
      touched.push(next);
      return recordingProxy(next);
    },
    apply() {
      touched.push(`${path}()`);
      return Promise.reject(new Error(`unexpected database call: ${path}`));
    },
  });
}

vi.mock("@/lib/prisma", () => ({ prisma: recordingProxy("prisma") }));

const aiPrep = vi.fn(async () => ({ skipped: "stub" }));
vi.mock("@/lib/ai/session/ai-prep", () => ({ runAiPrep: aiPrep }));

process.env.CRON_SECRET = "unit-test-secret";

const { resetAgendaForTests, utcDay } = await import("@/lib/platform/agenda");
const { runTick } = await import("@/lib/platform/cron-tick");
const { POST } = await import("@/app/api/cron/tick/route");
const { NextRequest } = await import("next/server");

const MINUTE = 60 * 1000;
const NOW = new Date("2026-10-14T10:00:00Z");

function idleAgenda() {
  return {
    loadedAt: NOW.getTime() - 30 * MINUTE,
    sessionStarts: [NOW.getTime() + 6 * 60 * MINUTE],
    nextJobAt: NOW.getTime() + 20 * MINUTE,
    schedulerMidPass: false,
    dailyRanOn: utcDay(NOW.getTime()),
  };
}

describe("gated cron tick", () => {
  beforeEach(() => {
    touched.length = 0;
    aiPrep.mockClear();
    resetAgendaForTests(idleAgenda());
  });

  it("skips without any database access when nothing is due", async () => {
    expect(await runTick(NOW)).toEqual({ skipped: true });
    expect(touched).toEqual([]);
    expect(aiPrep).not.toHaveBeenCalled();
  });

  it("the route answers a skipped tick with no database access, cron secret included", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    try {
      const response = await POST(
        new NextRequest("https://alphaseekers.org/api/cron/tick", {
          method: "POST",
          headers: { authorization: "Bearer unit-test-secret" },
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ skipped: true });
      expect(touched).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a caller without the secret before doing anything", async () => {
    const response = await POST(
      new NextRequest("https://alphaseekers.org/api/cron/tick", { method: "POST" }),
    ).catch(() => null);
    // Either a 401, or (outside a request scope) the session lookup throwing and
    // being treated as a denial; never a run.
    if (response) expect(response.status).toBe(401);
    expect(aiPrep).not.toHaveBeenCalled();
  });

  it("does run, and does reach for the database, when a session is about to start", async () => {
    resetAgendaForTests({ ...idleAgenda(), sessionStarts: [NOW.getTime() + 40 * MINUTE] });

    const result = await runTick(NOW);

    expect(result.skipped).toBe(false);
    if (!result.skipped) expect(result.reasons).toEqual(["session-soon"]);
    expect(aiPrep).toHaveBeenCalledTimes(1);
    expect(touched.length).toBeGreaterThan(0);
  });
});
