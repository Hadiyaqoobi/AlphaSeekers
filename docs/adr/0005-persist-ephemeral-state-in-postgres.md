# ADR-0005 — Persist ephemeral state in Postgres

- **Status:** Accepted (rate limiter, announcements, settings implemented;
  circuit-breaker shared state is Target)
- **Date:** 2026-07-18
- **Deciders:** Platform engineering
- **Related:** `src/lib/security/rate-limit.ts`, `src/lib/platform/db-store.ts`,
  `prisma/schema.prisma` (`RateLimitBucket`, `ClassAnnouncement`, `SiteSettings`)

## Context

Several pieces of state that behave like durable data were living in process
memory, which breaks in two ways the target deployment guarantees will happen:

- **Spin-down / redeploy loses it.** Render restarts on every deploy and (on
  cheaper tiers) sleeps when idle, so anything in a module-level variable is gone.
- **Multiple instances don't share it.** The moment the app runs more than one
  web instance, per-process state either multiplies (rate limits) or diverges
  (announcements), producing incoherent behavior.

Concretely:

- **Class announcements** were an in-memory array (`const announcementStore = []`)
  — a teacher's post vanished at the next spin-down, and horizontal scaling was
  impossible because each instance had a different list.
- **The auth/AI rate limiter** was a per-process `Map`. Its effective limit
  multiplied by instance count and reset on every cold start, so brute-force
  protection was unreliable exactly under load.
- **Site settings** had no persistent home.

## Decision

**Move state that must survive a restart or be shared across instances into
Postgres, keeping an in-memory fast path only as a graceful-degradation fallback,
never as the source of truth.**

New models (`prisma/schema.prisma`):

- **`RateLimitBucket`** (`schema.prisma:658-664`): `key` PK, `count`, `resetAt`,
  with `@@index([resetAt])` for reclaiming stale rows. A **fixed window aligned to
  `windowMs` is encoded into the row key**, so each window is its own row and a
  single **atomic upsert with `count: { increment: 1 }`** does the check-and-
  increment with no read-modify-write race (`rate-limit.ts:106-136`). On any DB
  error — or if the generated client doesn't yet expose the model — it **falls
  back to the in-memory limiter** so auth never hard-fails (`rate-limit.ts:117`,
  `:132-135`). Auth login is keyed by IP + email (`auth.ts:87`).
- **`ClassAnnouncement`** (`schema.prisma:668-679`): `classId`, `authorId`,
  `authorName`, `content`, `createdAt`, with `@@index([classId, createdAt])`.
  Announcements are now persisted via Prisma and read back per class through the
  store facade; the deliver-as-notification path is unchanged.
- **`SiteSettings`** (`schema.prisma:682-686`): a single `singleton` row holding
  platform-wide settings as JSON.

## Consequences

**Positive**

- Announcements survive deploys/spin-downs and are consistent across instances —
  a precondition for the second web instance in
  [ADR-0003](./0003-neon-connection-pooling-and-scaling.md).
- The rate limiter enforces a **global** window (atomic upsert, no race) instead
  of a per-process one, so it actually constrains distributed brute force, while
  degrading to the in-memory limiter rather than failing auth if the DB is
  briefly unavailable.
- Settings have a durable, queryable home.

**Negative / trade-offs**

- **Every rate-limited request now does a DB upsert.** This adds one write per
  auth/AI attempt. It is bounded (auth is low-volume; the row is tiny and
  keyed/indexed) and the fallback caps the blast radius of a DB hiccup, but it is
  real load on the same Postgres the rest of the app uses.
- **Stale `RateLimitBucket` rows accumulate.** Expired windows are not deleted
  inline; `@@index([resetAt])` makes a periodic cleanup cheap, but that cleanup
  job is not yet wired (a candidate for the data-retention cron).
- **The notification circuit-breaker is still in-process.** It is the one piece
  of ephemeral coordination state not yet externalized. Before running more than
  one web instance it should move to shared state (Redis or a Postgres table) so
  the breaker trips globally rather than per-instance. **Target.**
- Fixed-window (vs sliding-window/token-bucket) can allow a brief burst at a
  window boundary. Acceptable for auth throttling; a sliding window is a future
  refinement if abuse patterns warrant it.

## Alternatives considered

1. **Redis / Upstash for rate limits and the circuit breaker.** The conventional
   choice and likely the eventual one for the breaker. Deferred for the limiter:
   we already run Postgres, the atomic-upsert pattern gives correct global
   limiting with no new dependency, and the in-memory fallback preserves
   availability. Revisit when multi-instance + the breaker force a shared cache
   anyway.
2. **Keep announcements in memory but add sticky sessions.** Rejected: sticky
   sessions don't survive a redeploy or an instance loss, and the data is
   genuinely durable content, not a cache.
3. **A dedicated settings service / file.** Overkill; a single JSON `SiteSettings`
   row is transactional with the rest of the data and trivially backed up with it.
