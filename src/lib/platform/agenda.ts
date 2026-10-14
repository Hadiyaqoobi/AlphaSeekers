/**
 * The cron tick's agenda: what is coming up, kept in memory so that the hourly
 * tick can decide whether there is anything to do WITHOUT asking the database.
 *
 * Why: Neon bills the hours its compute is awake and suspends it after five idle
 * minutes. The old hourly pulse woke it 24 times a day whether or not anything
 * was due, about 61-73 awake hours a month on its own. Most of those hours had
 * nothing to send. See docs/adr/0008-only-wake-the-database-when-something-is-due.md.
 *
 * The web service is a single, always-on process, so it can remember:
 *   - the start times of sessions in the next 48 hours,
 *   - the earliest moment a queued job becomes due (or a stuck one can be reaped),
 *   - whether the scheduler is part-way through its class list,
 *   - whether the once-a-day work has run today.
 *
 * It is loaded with a handful of tiny queries, and refreshed only when the
 * database is awake anyway: after a write to `Session` or `Job` (debounced, from
 * the Prisma extension in `src/lib/prisma.ts`) and at the end of every full
 * tick. `planTick` is a pure function of the agenda and the clock; the hourly
 * tick calls it first and returns at once, with no query, when it says no.
 *
 * Fail-safe direction: anything uncertain (process just started, agenda older
 * than its horizon, a refresh that failed) means "run the full tick", never
 * "skip". A wasted wake costs minutes of compute; a missed reminder costs a
 * student her class.
 *
 * SINGLE-INSTANCE ASSUMPTION: a write handled by another process would not
 * refresh this one's agenda. With one web instance (today) that cannot happen.
 */
import { prisma } from "@/lib/prisma";
import { flushStoryViews } from "@/lib/platform/story-views";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * A session starting within this lead of a tick makes that tick run the
 * session work (reminders + AI prep). It must cover the furthest-ahead window
 * either of them looks at:
 *   - reminders: sessions starting 25-95 minutes ahead
 *     (REMINDER_LEAD_MINUTES 60 ± REMINDER_WINDOW_MINUTES/2 in db-store.ts);
 *   - AI prep:   sessions starting 5-75 minutes ahead.
 * `tests/agenda.test.ts` reads the reminder constants from db-store.ts and
 * proves every session start gets at least one tick that both runs and finds it.
 */
export const SESSION_LEAD_MS = 95 * MINUTE;

/** How far ahead session start times are loaded. The daily tick reloads well within it. */
export const AGENDA_HORIZON_MS = 48 * HOUR;

/**
 * The UTC hour of the once-a-day work: 02 UTC is 06:30 in Kabul, before the
 * school day, so digests are waiting when the team starts and the scheduler has
 * created the day's sessions before anyone looks for them.
 */
export const DAILY_HOUR_UTC = 2;

/** Matches `reapStalled`'s default: an ACTIVE job older than this is reclaimable. */
export const JOB_STALE_MS = 5 * MINUTE;

/**
 * Wait this long after the last Session/Job write before re-reading. Longer
 * than Prisma's default interactive-transaction timeout (5s), so a session
 * created inside a transaction has been committed when the agenda reads it;
 * reading before the commit would miss it, and with it its reminder.
 */
const REFRESH_DEBOUNCE_MS = 6_000;

export type Agenda = {
  /** Epoch ms when it was loaded. Session starts are known up to loadedAt + AGENDA_HORIZON_MS. */
  loadedAt: number;
  /** Epoch ms start times of upcoming, not-cancelled sessions, ascending. */
  sessionStarts: number[];
  /** Earliest epoch ms a queued job is due or a stuck one is reapable; null when the queue is idle. */
  nextJobAt: number | null;
  /** The scheduler has a RUNNING pass with classes still to process. */
  schedulerMidPass: boolean;
  /** UTC day (YYYY-MM-DD) the daily work last ran, if known. */
  dailyRanOn: string | null;
};

export type TickReason =
  | "cold" // nothing loaded since this process started
  | "agenda-expired" // the agenda's session horizon no longer covers the lead
  | "session-soon"
  | "job-due"
  | "scheduler-mid-pass"
  | "daily";

export type TickPlan = {
  run: boolean;
  reasons: TickReason[];
  /** The agenda must be (re)loaded before the remaining fields mean anything. */
  needsAgenda: boolean;
  /** Enqueue the reminder batch and run AI prep. */
  sessionWork: boolean;
  /** Run the scheduler (daily, or to continue a pass over many classes). */
  scheduler: boolean;
  /** Run the once-a-day work. */
  daily: boolean;
};

/** UTC calendar day, the same bucketing the daily digests use for their dedupe keys. */
export function utcDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * Decide what a tick at `now` has to do. PURE: no I/O, no clock reads.
 *
 * `run: false` means the tick must return without touching the database.
 */
export function planTick(agenda: Agenda | null, now: number): TickPlan {
  if (!agenda) {
    return {
      run: true,
      reasons: ["cold"],
      needsAgenda: true,
      sessionWork: false,
      scheduler: false,
      daily: false,
    };
  }

  const reasons: TickReason[] = [];

  const needsAgenda = now + SESSION_LEAD_MS > agenda.loadedAt + AGENDA_HORIZON_MS;
  if (needsAgenda) reasons.push("agenda-expired");

  const sessionWork = agenda.sessionStarts.some(
    (start) => start > now && start <= now + SESSION_LEAD_MS,
  );
  if (sessionWork) reasons.push("session-soon");

  if (agenda.nextJobAt !== null && agenda.nextJobAt <= now) reasons.push("job-due");

  if (agenda.schedulerMidPass) reasons.push("scheduler-mid-pass");

  const daily =
    new Date(now).getUTCHours() >= DAILY_HOUR_UTC && agenda.dailyRanOn !== utcDay(now);
  if (daily) reasons.push("daily");

  return {
    run: reasons.length > 0,
    reasons,
    needsAgenda,
    sessionWork,
    scheduler: daily || agenda.schedulerMidPass,
    daily,
  };
}

// ─── In-memory state ──────────────────────────────────────────────────────────

type AgendaState = {
  agenda: Agenda | null;
  /** Survives a failed refresh (which drops `agenda`), so the day is not re-run. */
  dailyRanOn: string | null;
  refreshTimer: ReturnType<typeof setTimeout> | null;
  refreshing: Promise<Agenda | null> | null;
  refreshAgain: boolean;
  tickInFlight: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var alphaseekersAgenda: AgendaState | undefined;
}

// On globalThis because the Prisma extension (imported by every bundle) and the
// tick route (its own bundle) must see the same agenda.
function state(): AgendaState {
  if (!globalThis.alphaseekersAgenda) {
    globalThis.alphaseekersAgenda = {
      agenda: null,
      dailyRanOn: null,
      refreshTimer: null,
      refreshing: null,
      refreshAgain: false,
      tickInFlight: false,
    };
  }
  return globalThis.alphaseekersAgenda;
}

export function getAgenda(): Agenda | null {
  return state().agenda;
}

/** Record that the daily work has been started for `day`, so no later tick repeats it. */
export function markDailyRan(day: string): void {
  const s = state();
  s.dailyRanOn = day;
  if (s.agenda) s.agenda = { ...s.agenda, dailyRanOn: day };
}

/**
 * Claim the single tick slot. Returns false when a tick is already running in
 * this process (the cron and a manual run overlapping); the caller skips.
 */
export function beginTick(): boolean {
  const s = state();
  if (s.tickInFlight) return false;
  s.tickInFlight = true;
  return true;
}

export function endTick(): void {
  state().tickInFlight = false;
}

/**
 * Read the agenda from the database. A few tiny indexed queries.
 *
 * "Has the daily work run today" survives a restart through the daily KPI
 * digest's dedupe key (`kpi_digest:<UTC day>`), which the daily work enqueues:
 * without that, every deploy after 02 UTC would run the day's work again. (It
 * is all idempotent, so that would cost a little compute, not a duplicate.)
 */
export async function loadAgenda(now: number = Date.now()): Promise<Agenda> {
  const today = utcDay(now);

  const [sessions, nextJob, oldestActive, scheduler, digest] = await Promise.all([
    prisma.session.findMany({
      where: {
        cancelled: false,
        startTime: { gt: new Date(now), lte: new Date(now + AGENDA_HORIZON_MS) },
      },
      select: { startTime: true },
      orderBy: { startTime: "asc" },
      take: 2000,
    }),
    prisma.job.findFirst({
      where: { status: { in: ["PENDING", "FAILED"] } },
      orderBy: { runAt: "asc" },
      select: { runAt: true },
    }),
    prisma.job.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { lockedAt: "asc" },
      select: { lockedAt: true },
    }),
    prisma.schedulerJob.findFirst({
      where: { status: "RUNNING" },
      select: { id: true },
    }),
    prisma.job.findFirst({
      where: { dedupeKey: `kpi_digest:${today}` },
      select: { id: true },
    }),
  ]);

  const dueTimes: number[] = [];
  if (nextJob) dueTimes.push(nextJob.runAt.getTime());
  if (oldestActive) {
    // An ACTIVE job with no lock time is reapable as soon as anyone looks.
    dueTimes.push(oldestActive.lockedAt ? oldestActive.lockedAt.getTime() + JOB_STALE_MS : now);
  }

  const remembered = state().dailyRanOn;

  return {
    loadedAt: now,
    sessionStarts: sessions.map((s) => s.startTime.getTime()),
    nextJobAt: dueTimes.length > 0 ? Math.min(...dueTimes) : null,
    schedulerMidPass: scheduler !== null,
    dailyRanOn: digest ? today : remembered,
  };
}

async function doRefresh(): Promise<Agenda | null> {
  const s = state();
  try {
    const agenda = await loadAgenda();
    s.agenda = agenda;
    if (agenda.dailyRanOn) s.dailyRanOn = agenda.dailyRanOn;
  } catch (error) {
    // Unknown is treated as "run the next tick in full", never as "nothing due".
    s.agenda = null;
    console.error("[agenda] refresh failed; next tick will run in full:", error);
  }

  // The database is awake right now, which is the one moment buffered story
  // views can be written for free.
  try {
    await flushStoryViews();
  } catch {
    // flushStoryViews does not throw; this is belt and braces.
  }

  return s.agenda;
}

/**
 * Reload the agenda now. Never throws; returns null if it could not be loaded
 * (and leaves the agenda unloaded, so the next tick runs in full).
 *
 * Concurrent callers share one reload; a request that arrives during a reload
 * triggers exactly one more afterwards, since the data may have changed.
 */
export async function refreshAgenda(): Promise<Agenda | null> {
  const s = state();
  if (s.refreshTimer) {
    clearTimeout(s.refreshTimer);
    s.refreshTimer = null;
  }

  if (s.refreshing) {
    s.refreshAgain = true;
    return s.refreshing;
  }

  const run = (async () => {
    let result = await doRefresh();
    while (state().refreshAgain) {
      state().refreshAgain = false;
      result = await doRefresh();
    }
    return result;
  })();

  s.refreshing = run;
  try {
    return await run;
  } finally {
    state().refreshing = null;
  }
}

/**
 * Called by the Prisma extension after every write to `Session` or `Job`.
 * Debounced so a burst (a queue drain, a scheduler pass) causes one reload,
 * timed from the last write, after any surrounding transaction has committed.
 * Never throws; the timer does not keep the process alive.
 */
export function scheduleAgendaRefresh(): void {
  const s = state();
  if (s.refreshTimer) clearTimeout(s.refreshTimer);
  const timer = setTimeout(() => {
    state().refreshTimer = null;
    void refreshAgenda().catch(() => undefined);
  }, REFRESH_DEBOUNCE_MS);
  timer.unref?.();
  s.refreshTimer = timer;
}

/** Test seam: forget everything and cancel a pending refresh. */
export function resetAgendaForTests(agenda: Agenda | null = null): void {
  const current = globalThis.alphaseekersAgenda;
  if (current?.refreshTimer) clearTimeout(current.refreshTimer);
  globalThis.alphaseekersAgenda = undefined;
  if (agenda) state().agenda = agenda;
}
