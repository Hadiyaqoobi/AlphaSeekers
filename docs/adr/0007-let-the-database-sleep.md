# ADR-0007 — Let the database sleep

- **Status:** Accepted (implemented)
- **Date:** 2026-10-13
- **Deciders:** Platform engineering
- **Related:** `src/app/api/health/route.ts`, `src/lib/platform/public-cache.ts`,
  `src/lib/platform/public-data.ts`, `src/lib/prisma.ts`,
  `src/app/api/cron/worker/route.ts`, `render.yaml`, ADR-0003 (Neon pooling and
  scaling), ADR-0005 (persist ephemeral state in Postgres)

## Context

The database is Neon serverless Postgres. Neon does not bill for how much data is
stored so much as for **how many hours the compute is awake**, and it suspends the
compute after five idle minutes. The paid plan was cancelled in October 2026, which
put the project back on the free allowance of 100 compute-unit hours a month (about
400 awake hours at the smallest size).

Read against that model, three things in the deployment were waking the database
for no user's benefit:

1. **The health check.** `render.yaml` points Render's `healthCheckPath` at
   `/api/health`, and that route ran `SELECT 1`. Render calls the path every few
   seconds for as long as the service runs. The compute therefore never saw five
   idle minutes and never suspended: about 730 awake hours, or 180 compute-unit
   hours, a month. On the free allowance that is an outage around the 17th of
   every month. The setting has been in `render.yaml` since 2026-07-19 and was
   missed when the crons were consolidated in August, because that work only
   looked at crons.
2. **Signed-out page views.** The landing page queried site settings and the "open
   now" lists on every request, and the public library, webinars, opportunities and
   Student Voices pages did the same. One crawler fetching `/` woke the database and
   held it awake for five more minutes.
3. **Separate daily crons.** Data retention and the daily digests each had their
   own cron service, so each paid for its own wake.

The idea of moving data out of Postgres into Google Forms and Sheets was considered
first, because it is the obvious reading of "use less database". It does not help:
storage is a rounding error here (hundreds of users), and the cost is awake time.

## Decision

**Nothing may wake the database unless a signed-in person, or the hourly pulse, needs it.**

- **`/api/health` is liveness only.** It answers without a query. `?deep=1` keeps
  the old `SELECT 1` readiness check for manual use after a deploy.
- **Public pages read through an in-process cache.** `public-data.ts` holds a
  cached twin of each loader a signed-out page uses. Admin pages, API routes and
  tests keep calling the loaders directly.
- **Invalidation is automatic.** A Prisma client extension (`src/lib/prisma.ts`)
  marks the matching cache scope stale on any write to `SiteSettings`, `Class`,
  `Enrollment`, `Webinar`, `Opportunity`, `LibraryResource` or `StudentPost`. No
  call site has to remember, and writes added later are covered.
- **The pulse refreshes the cache.** The worker step, last in the hourly pulse,
  re-runs every cached loader while the database is awake anyway. The TTL (2h) is
  longer than the pulse, so entries are renewed before they expire.
- **One cron.** The daily jobs run inside the pulse at 03 and 06 UTC.

## Consequences

**Good**

- The database wakes for the hourly pulse (about 18 of the 100 monthly hours) and
  for real signed-in use, and otherwise sleeps.
- A database outage no longer blanks the public site: the cache serves the last
  good value, and the health check no longer restart-loops the web service over a
  fault a restart cannot fix.
- Two fewer billed Render services.

**Accepted trade-offs**

- **Render no longer notices an unreachable database on its own.** A deploy with a
  wrong `DATABASE_URL` passes the health check. The pre-deploy migration step
  still fails such a deploy if `DIRECT_DATABASE_URL` is wrong, and
  `/api/health?deep=1` is the manual check.
- **The cache is per process.** Correct for the single web instance run today.
  With more than one instance a write invalidates only the instance that handled
  it; the others catch up at the next hourly refresh. Move the cache to a shared
  store before scaling out.
- **Changes the hook cannot see lag by up to an hour:** rows edited by hand in the
  Neon console, rows removed by a database cascade, and a renamed teacher (`User`
  is deliberately not hooked — it is written on every sign-up). The hourly refresh
  picks all of these up. A redeploy clears the cache immediately.
- **Time-based changes are exact only on the landing page**, where passed deadlines
  are filtered on every read. On the opportunities list an item can show as open
  for up to an hour after its deadline.

**Still wakes the database, by design**

- Sign-in, registration, password reset and the public class-join page: these are
  real people about to need it.
- A story view from a real browser records a view count.
- Bots posting to the auth endpoints, because rate-limit buckets live in Postgres
  (ADR-0005).

## Alternatives considered

- **Move registration or content to Google Forms / Sheets.** Rejected as a cost
  measure for the reason in Context. Forms remain the right tool for things that
  would otherwise need new tables: per-class extra questions, teacher applications,
  feedback surveys.
- **Next.js `unstable_cache` / ISR.** Rejected: every one of these pages reads the
  session cookie in the shared layout, so none can be statically cached, and
  `unstable_cache` would have cached the loaders' fail-open empty results on a
  database error.
- **Invalidate at each call site.** Rejected: writes to these models are spread
  across the stores, API routes and transactions. A missed call site is exactly the
  "I saved it and nothing changed" bug this team has reported before.
- **A different free Postgres host without a compute-hour meter.** Not needed once
  the wakes are removed; remains the fallback if real usage outgrows the allowance.
