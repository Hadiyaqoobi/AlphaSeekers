/**
 * Unit tests for the cron tick's decision function.
 *
 * `planTick` decides, from memory alone, whether the hourly tick may wake the
 * Neon database. It is the whole cost saving of ADR-0008, and it is also the
 * one place that could silently stop a reminder being sent. Both directions are
 * pinned here: nothing due ⇒ skip; anything due, or anything unknown ⇒ run.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  AGENDA_HORIZON_MS,
  DAILY_HOUR_UTC,
  SESSION_LEAD_MS,
  planTick,
  utcDay,
  type Agenda,
} from "@/lib/platform/agenda";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// 10:00 UTC: after the daily hour, so "daily already ran" must be set explicitly.
const NOW = Date.parse("2026-10-14T10:00:00Z");

function agenda(overrides: Partial<Agenda> = {}): Agenda {
  return {
    loadedAt: NOW - 30 * MINUTE,
    sessionStarts: [],
    nextJobAt: null,
    schedulerMidPass: false,
    dailyRanOn: utcDay(NOW),
    ...overrides,
  };
}

describe("planTick", () => {
  it("skips when nothing is due", () => {
    const plan = planTick(agenda(), NOW);
    expect(plan.run).toBe(false);
    expect(plan.reasons).toEqual([]);
  });

  it("runs in full when nothing has been loaded since the process started", () => {
    const plan = planTick(null, NOW);
    expect(plan).toMatchObject({ run: true, needsAgenda: true, reasons: ["cold"] });
  });

  it("runs the session work when a session starts within the lead", () => {
    const plan = planTick(agenda({ sessionStarts: [NOW + 90 * MINUTE] }), NOW);
    expect(plan).toMatchObject({ run: true, sessionWork: true, daily: false });
    expect(plan.reasons).toEqual(["session-soon"]);
  });

  it("ignores sessions further out than the lead, and ones already started", () => {
    const plan = planTick(
      agenda({ sessionStarts: [NOW - 10 * MINUTE, NOW, NOW + SESSION_LEAD_MS + MINUTE] }),
      NOW,
    );
    expect(plan.run).toBe(false);
  });

  it("drains when a queued job is due, and not before", () => {
    expect(planTick(agenda({ nextJobAt: NOW + MINUTE }), NOW).run).toBe(false);

    const plan = planTick(agenda({ nextJobAt: NOW - MINUTE }), NOW);
    expect(plan).toMatchObject({ run: true, sessionWork: false, daily: false });
    expect(plan.reasons).toEqual(["job-due"]);
  });

  it("keeps running the scheduler while a pass over many classes is unfinished", () => {
    const plan = planTick(agenda({ schedulerMidPass: true }), NOW);
    expect(plan).toMatchObject({ run: true, scheduler: true, daily: false });
  });

  it("runs the daily work at the daily hour, once", () => {
    const at = Date.parse(`2026-10-14T0${DAILY_HOUR_UTC}:00:00Z`);
    const yesterday = utcDay(at - 24 * HOUR);

    const plan = planTick(agenda({ loadedAt: at - HOUR, dailyRanOn: yesterday }), at);
    expect(plan).toMatchObject({ run: true, daily: true, scheduler: true });

    expect(planTick(agenda({ loadedAt: at - HOUR, dailyRanOn: utcDay(at) }), at).run).toBe(false);
  });

  it("does not run the daily work before its hour", () => {
    const at = Date.parse("2026-10-14T01:00:00Z");
    const plan = planTick(agenda({ loadedAt: at - HOUR, dailyRanOn: "2026-10-13" }), at);
    expect(plan.run).toBe(false);
  });

  it("catches up on the daily work if its hour was missed", () => {
    const at = Date.parse("2026-10-14T05:00:00Z");
    const plan = planTick(agenda({ loadedAt: at - HOUR, dailyRanOn: "2026-10-13" }), at);
    expect(plan.daily).toBe(true);
  });

  it("reloads once the agenda no longer covers the lead", () => {
    const plan = planTick(agenda({ loadedAt: NOW - AGENDA_HORIZON_MS + HOUR }), NOW);
    expect(plan).toMatchObject({ run: true, needsAgenda: true });
    expect(plan.reasons).toContain("agenda-expired");
  });
});

/**
 * The proof that gating the tick cannot lose a reminder.
 *
 * Reminders are sent by `runReminderBatch` (db-store.ts) for sessions starting
 * between LEAD - WINDOW/2 and LEAD + WINDOW/2 minutes after it runs. The
 * constants are read from that file, so if someone narrows the window this test
 * fails rather than reminders silently stopping.
 *
 * Model: the cron fires hourly, each firing up to `jitter` late (Render's cron
 * is not to-the-second), and the reminder job itself runs `drainDelay` after
 * the tick (it is enqueued and then drained in the same tick). For every session
 * start time over a three-hour span, at one-minute resolution plus odd seconds,
 * there must be a tick that BOTH decides to run the session work AND whose
 * reminder batch window contains the session.
 */
describe("reminder coverage under an hourly gated tick", () => {
  const source = readFileSync("src/lib/platform/db-store.ts", "utf8");
  const lead = Number(/const REMINDER_LEAD_MINUTES = (\d+);/.exec(source)?.[1]);
  const width = Number(/const REMINDER_WINDOW_MINUTES = (\d+);/.exec(source)?.[1]);
  const fromMs = (lead - width / 2) * MINUTE; // inclusive (gte)
  const toMs = (lead + width / 2) * MINUTE; // exclusive (lt)

  it("reads the real reminder window", () => {
    expect(lead).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(0);
  });

  it("gates on a lead that covers the whole reminder window and AI prep's", () => {
    expect(SESSION_LEAD_MS).toBeGreaterThanOrEqual(toMs);
    expect(SESSION_LEAD_MS).toBeGreaterThanOrEqual(75 * MINUTE); // AI prep: 5-75 min
  });

  const base = Date.parse("2026-10-14T00:00:00Z");

  // Jitter patterns: on time; consistently late; alternately on time and late
  // (the worst case, since it stretches the gap between two runs).
  const patterns: Array<{ name: string; jitter: (k: number) => number }> = [
    { name: "on time", jitter: () => 0 },
    { name: "always 4 min late", jitter: () => 4 * MINUTE },
    { name: "alternating 0 / 5 min late", jitter: (k) => (k % 2 === 0 ? 0 : 5 * MINUTE) },
    { name: "alternating 5 / 0 min late", jitter: (k) => (k % 2 === 0 ? 5 * MINUTE : 0) },
  ];

  for (const pattern of patterns) {
    for (const drainDelay of [0, 2 * MINUTE]) {
      it(`every session gets its reminder (${pattern.name}, job runs +${drainDelay / MINUTE} min)`, () => {
        const ticks = Array.from({ length: 8 }, (_, k) => base + k * HOUR + pattern.jitter(k));
        const missed: string[] = [];

        // Sessions from 2h to 5h after the first tick, so every one has a full
        // set of earlier ticks in front of it.
        for (let offset = 2 * HOUR; offset <= 5 * HOUR; offset += MINUTE) {
          for (const seconds of [0, 17, 59]) {
            const start = base + offset + seconds * 1000;
            const reminded = ticks.some((tick) => {
              const plan = planTick(
                agenda({ loadedAt: tick - MINUTE, sessionStarts: [start], dailyRanOn: utcDay(tick) }),
                tick,
              );
              if (!plan.sessionWork) return false;
              const runsAt = tick + drainDelay;
              return start >= runsAt + fromMs && start < runsAt + toMs;
            });
            if (!reminded) missed.push(new Date(start).toISOString());
          }
        }

        expect(missed).toEqual([]);
      });
    }
  }

  it("would miss reminders if the reminder window were narrower than the tick spacing", () => {
    // Sanity check that the harness can fail: a 50-minute window (narrower than
    // the hourly spacing) must leave some sessions unreminded.
    const ticks = Array.from({ length: 8 }, (_, k) => base + k * HOUR);
    const narrowFrom = 35 * MINUTE;
    const narrowTo = 85 * MINUTE;
    let missed = 0;
    for (let offset = 2 * HOUR; offset <= 5 * HOUR; offset += MINUTE) {
      const start = base + offset;
      const ok = ticks.some((tick) => start >= tick + narrowFrom && start < tick + narrowTo);
      if (!ok) missed += 1;
    }
    expect(missed).toBeGreaterThan(0);
  });
});
