# ADR-0008 — Only wake the database when something is due

- **Status:** Accepted (implemented)
- **Date:** 2026-10-14
- **Deciders:** Platform engineering
- **Supersedes:** the "hourly pulse" part of ADR-0007 (the rest of ADR-0007 stands)
- **Related:** `src/lib/platform/agenda.ts`, `src/lib/platform/cron-tick.ts`,
  `src/app/api/cron/tick/route.ts`, `src/lib/prisma.ts`,
  `src/lib/platform/public-cache.ts`, `src/lib/platform/public-data.ts`,
  `src/lib/platform/story-views.ts`, `src/app/robots.ts`, `render.yaml`,
  ADR-0004 (fan-out through the queue), ADR-0006 (Postgres job queue),
  ADR-0007 (let the database sleep)

## Context

The organisation runs on Neon's **free** plan: 100 compute-unit hours (CU-h) a
month, which is about **400 awake hours** at the smallest compute size (0.25 CU).
Neon bills the time the compute is **awake**, and suspends it after five idle
minutes. So what costs money is *how often something wakes the database*, not how
much data it holds. Each wake costs roughly 5–6 minutes (the work plus the five
idle minutes before suspend), whatever the work is.

ADR-0007 removed the health check and signed-out page views as wake sources and
folded the daily crons into one hourly pulse. A review then measured that pulse on
its own:

| | Wakes / month | Awake hours / month | CU-h / month (0.25 CU) |
| --- | --- | --- | --- |
| Hourly pulse (ADR-0007) | 24 × 30.4 ≈ 730 | 730 × 5–6 min ≈ **61–73** | ≈ 15–18 |

Most of those hours had nothing to do. The pulse curled six endpoints, every one
of which queried the database (enqueue reminders, enqueue the scheduler, AI prep,
drain the queue…) even in an hour with no class, no queued job and no daily work.

Three smaller wake sources were also left:

- **The public join page** (`/[locale]/join/[classId]`) queried on every hit, and
  the landing page links every crawler to it. WhatsApp's link previewer fetches it
  whenever the link is shared, and ignores `robots.txt`.
- **Story views.** The story page is cached, but its view beacon ran
  `studentPost.update({ viewCount })` per reader, waking the database anyway; and
  that write invalidated every cached story page.
- **Cache refresh.** With a 2-hour TTL, the cache depended on the hourly pulse to
  stay warm. Remove the hourly work and every entry would expire and be rebuilt by
  a stranger's request, which wakes the database.

## Decision

**The hourly cron asks the web process whether anything is due. The web process
answers from memory. The database is touched only when the answer is yes.**

The web service is one always-on `starter` instance, so it can keep a small
in-memory **agenda** (`src/lib/platform/agenda.ts`):

- start times of sessions in the next 48 hours;
- the earliest moment a queued job becomes due (or a stuck ACTIVE one can be reaped);
- whether the scheduler is part-way through its class list;
- whether today's daily work has run (in memory, and after a restart from the
  `kpi_digest:<UTC day>` dedupe key the daily work enqueues).

It is loaded with five tiny indexed queries, and refreshed only when the database
is awake anyway:

- after any write to `Session` or `Job`, from the Prisma extension that already
  invalidates the public cache (`src/lib/prisma.ts`), debounced 6 s so a burst of
  writes causes one read, after any surrounding transaction has committed (Prisma's
  default interactive-transaction timeout is 5 s);
- at the end of every full tick.

The one Render cron calls **`POST /api/cron/tick`**, hourly. `planTick` (a pure,
unit-tested function) runs the full work only if:

| Condition | Work |
| --- | --- |
| the agenda is not loaded since restart, or no longer covers the lead | load it, then decide again |
| a session starts within the next **95 min** | enqueue reminders, run AI prep |
| a queued job is due | drain the queue |
| the scheduler is mid-pass over more than 10 classes | continue it |
| it is **02 UTC** (06:30 Kabul) or later and the daily work has not run today | scheduler (incl. its Meet-link retry), data retention, KPI + pending-approvals + class-health digests, public-cache refresh |

Every full tick also drains the queue, flushes buffered story views and reloads the
agenda. Otherwise the tick returns `{ "skipped": true }` **without a single query**.
The cron secret check is a header compare, so even authorisation needs no query.
This is proven by `tests/integration/cron-tick.int.test.ts`, which counts every SQL
statement the Prisma engine sends.

**Why 95 minutes.** Reminders go to sessions starting 25–95 min after the batch
runs (`REMINDER_LEAD_MINUTES` 60 ± `REMINDER_WINDOW_MINUTES`/2 in `db-store.ts`);
AI prep looks 5–75 min ahead. The gate must cover the furthest of those. The
70-minute reminder window is wider than the 60-minute tick spacing, so every
session falls inside the window of at least one tick, with up to ~10 minutes of
slack for a late cron or a slow drain. `tests/agenda.test.ts` reads the real
constants from `db-store.ts` and checks every session start, minute by minute over
three hours, under on-time, late and alternating-late cron patterns: none is missed.

**Fail-safe direction.** Anything uncertain means *run*: a fresh process, an agenda
past its horizon, an agenda refresh that failed (it is then dropped, not kept
stale). A wasted wake costs minutes of compute; a missed reminder costs a student
her class.

Alongside the tick:

- **Public cache TTL 26 h** (was 2 h). The daily tick renews every entry, so a
  renewed entry never expires before the next one.
- **Reload after write.** When a write invalidates a cache scope, its entries are
  re-loaded ~6 s later (after the 3 s settle window and any surrounding
  transaction), while the write still has the database awake, so the next
  stranger is served from memory.
- **Counter-only updates do not invalidate.** A `StudentPost` update touching only
  `viewCount`/`likeCount` leaves the story cache alone.
- **Misses are cached.** "No such story" and "no such public class" are cached too
  (bounded by the cache's 200-entry cap); any `StudentPost` / `Class` write
  invalidates the scope, so a newly published story or class appears at once. An
  unknown opportunity `?type=` is served from the "ALL" entry (it used to make
  Prisma throw), and `expired` is recomputed on every read.
- **Join page through the cache** (scope `landing`, which `Class` and `Enrollment`
  writes already invalidate, so `seatsLeft` stays right). Signed-in visitors are
  still redirected to the class page; a signed-out visit does no database work
  when the entry is cached.
- **`robots.txt`** disallows `/*/join/`, `/*/classes/`, `/*/stories/write` and
  `/api/`.
- **Story views are buffered in memory** and written when the database is awake
  anyway (every full tick, and every agenda refresh). Likes stay immediate writes.
- **One Prisma client per process,** production included (it used to be stored on
  `globalThis` only in development, so separately bundled pages and routes could
  each build their own client and pool).
- **Manual cron runs need a live super-admin check** (was: any JWT with role
  `ADMIN`, scoped employees included), and every cron handler this change owns is
  POST-only, so a cross-site GET cannot start one with an admin's cookies.

## Consequences

### Expected cost

From the tick alone (real signed-in use comes on top, and often overlaps):

- daily work: 1 wake/day ≈ **30** wakes/month;
- per class meeting: at most **3** wakes (the tick before each of its two
  60-minute segments, plus the one in between); fewer when people are signed in
  during class, because the database is then awake anyway;
- jobs due outside an awake period (retries with backoff): a handful;
- restarts and deploys: one wake each.

| Scenario | Wakes / month | Awake hours / month | CU-h (0.25 CU) |
| --- | --- | --- | --- |
| Before (hourly pulse) | ≈ 730 | **61–73** | 15–18 |
| After, today (≈ 2 classes, 2 meetings/week each ≈ 17 meetings) | 30 + 51 + ~15 ≈ 96 | **≈ 8–10** | ≈ 2–2.5 |
| After, 10 classes × 2 meetings/week (≈ 87 meetings) | 30 + 261 + ~15 ≈ 306 | ≈ 26–31 | ≈ 6.5–8 |
| Ceiling (something due every hour) | 730 | 61–73 | 15–18 |

The ceiling equals the old cost: the gate can only remove wakes, never add them.

### Accepted trade-offs

- **The first visitor after an idle spell waits 1–3 s** while Neon resumes. More of
  the day is now idle, so more first visits pay it. Public pages are served from
  memory and do not.
- **Hand edits in the Neon console can take up to a day to show** on public pages
  (the next daily refresh or the 26 h TTL), because the Prisma hook cannot see
  them. Redeploying (or restarting) the web service clears the cache at once. The
  same applies to rows removed by a database cascade and to a renamed teacher
  (`User` is not hooked).
- **Like and view counts on cached public pages lag by up to a day.** The liker
  sees their own like immediately in the UI; the count shown to strangers catches
  up at the next refresh. Buffered view counts since the last flush are **lost on
  restart** (a deploy); they are a popularity signal, not a record.
- **The scheduler runs once a day** instead of hourly. A new AUTO class gets its
  next session at the next 02 UTC tick, or immediately with the admin "Run
  scheduler" button. A pass over more than 10 classes continues hourly until done.
- **Single-instance assumption.** The agenda, the cache and the view buffer live in
  one process. A second web instance would not see the first one's writes: its
  agenda could miss a session (a missed reminder) and its cache would lag. Before
  scaling out, move these to a shared store or run the tick against the database
  unconditionally.
- **A restart after 02 UTC re-runs the daily work** only if the KPI digest was
  never enqueued that day. Everything in it is idempotent (retention deletes older
  than a cutoff, digests are deduped per day), so the worst case is a little
  compute, not a duplicate email.

### Still wakes the database, by design

Sign-in, registration, password reset, joining a class, every signed-in page; bots
posting to the auth endpoints (rate-limit buckets live in Postgres, ADR-0005); and
`/api/health?deep=1` when someone calls it.

## Operational checklist (by hand, in the dashboards)

These cannot be done from the repository.

**Render**

- [ ] Delete every cron service except **`alphaseekers-pulse`** (look for
      `alphaseekers-data-retention`, `alphaseekers-kpi-digest`, `neon-warm`,
      `alphaseekers-worker`, …). Removing a service from `render.yaml` does not
      delete it on Render.
- [ ] Confirm the pulse's command is the single `curl … /api/cron/tick` (a
      blueprint sync does this; a manually created service must be edited).
- [ ] Confirm no external uptime monitor (UptimeRobot, Better Stack, a teammate's
      script, …) calls `/api/health?deep=1`. The plain `/api/health` is fine.
- [ ] Keep the web service at **one** instance.

**Neon**

- [ ] Compute size: **min = max = 0.25 CU** (autoscaling off). A larger maximum
      burns the 100 CU-h faster for no benefit at this load.
- [ ] Scale to zero / suspend after 5 minutes: **on** (the default on the free plan).
- [ ] Region: the closest available to Render's `oregon` (AWS `us-west-2`); a
      cross-country hop adds latency to every query.
- [ ] In **Monitoring**, confirm the compute shows as suspended between ticks on a
      quiet day (no active time in most hours).

**Development**

- [ ] Use a **local Postgres** for development and tests. Never point a dev server,
      a test run or a migration at the production database: every local query is a
      production wake (and the shared-database history of this project shows what
      else can go wrong).

## Alternatives considered

- **Keep the hourly pulse but make each endpoint cheaper.** Rejected: the cost is
  the wake, not the query. One `SELECT 1` an hour still costs ~61 h a month.
- **Neon paid plan / Render Standard.** Rejected for this organisation: it is a
  nonprofit that cancelled the paid plan on purpose, and nothing in its load needs
  it.
- **A separate free Postgres host without a compute-hour meter (e.g. Supabase
  free).** Kept as the fallback **only** if real usage exceeds roughly 350 awake
  hours a month (most of the 400-hour allowance). Not needed at today's usage.
- **Event-driven timers in the web process instead of a cron** (setTimeout for each
  session). Rejected: lost on every restart, and the cron is the safety net that
  survives one. The agenda is the same idea with the cron kept as the clock.
