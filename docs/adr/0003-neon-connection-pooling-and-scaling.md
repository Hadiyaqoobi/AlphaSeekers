# ADR-0003 — Neon connection pooling and the scaling floor

- **Status:** Accepted (code support implemented; infra sizing is Target)
- **Date:** 2026-07-18
- **Deciders:** Platform engineering
- **Related:** `src/lib/prisma.ts`, `render.yaml`, `docs/DEPLOYMENT_RUNBOOK.md`,
  `src/lib/platform/db-store.ts`

## Context

The target is 10,000 registered students, ~500–1,000 concurrent at peak. The
original deployment was a single Render **free** web service against Neon's
**direct** (non-pooled) endpoint with no `connection_limit` and Prisma's default
pool sizing. The capacity model showed this configuration saturating at roughly
**20–60 concurrently active users — about 4–6% of the target peak** — and
failing in a specific order:

1. Render free 0.1 vCPU saturates first (SSR dashboards run 6+ sequential store
   calls each).
2. Neon free compute-hours are exhausted within month 1 (a 24/7 keep-warm cron
   alone ≈ 180 CU-h against a ~190 CU-h/month allowance).
3. Gmail SMTP's ~500/day cap is hit on the first full reminder fan-out.
4. 512 MB RAM OOMs under request queueing.
5. Neon 0.5 GB storage fills in ~2–3 months (one `Notification` row per delivery,
   no TTL).
6. On any horizontal scale-out, the **direct** endpoint's connection cap is
   exhausted — Prisma's default pool is `num_cpus * 2 + 1` **per instance**, so N
   instances against the direct host multiply connections and hit
   `too many connections`.

The audit's key finding: **the only code path that needs re-architecting to reach
the target is the notification fan-out** (see
[ADR-0004](./0004-notification-fanout-out-of-request-path.md)). Everything else is
tier sizing plus using Neon's pooled endpoint correctly.

## Decision

**Make the application pooler-ready in code, document the pooled endpoint as a
hard production requirement, and specify the ~$70–90/month infrastructure floor
in the blueprint and runbook. Design concurrency-control to be compatible with
PgBouncer transaction pooling.**

Code (`src/lib/prisma.ts`):

- `buildDatabaseUrl()` appends `?connection_limit=<n>` from
  `DATABASE_CONNECTION_LIMIT` when the caller has not already set it
  (`prisma.ts:23-41`), so per-instance pool size is a tunable env var.
- The module header documents that in production `DATABASE_URL` **must** be the
  Neon `-pooler` (PgBouncer, transaction mode) host, and explains why: serverless
  bursts open many short-lived connections that exhaust the direct endpoint's cap.

PgBouncer-compatibility (`db-store.ts`):

- Concurrency control uses **transaction-scoped** advisory locks
  (`pg_advisory_xact_lock` inside `prisma.$transaction`) for the enrollment
  capacity guard (`db-store.ts:1458-1459`) and the scheduler claim
  (`db-store.ts:2221-2222`). Transaction-scoped locks release on commit, so they
  are safe under transaction pooling; **session-scoped** locks would not be,
  because PgBouncer does not pin a client to a backend connection across
  statements. This was a deliberate choice made *because* the target uses the
  pooled endpoint.

Infrastructure (`render.yaml`, runbook §5) — the ~$70–90/mo floor:

- Render **Standard** web service (done in `render.yaml:21`); a second instance
  for capacity + redundancy is **Target**.
- Neon **paid** plan with the `-pooler` `DATABASE_URL` and a bounded
  `connection_limit`.
- Five Render **cron** services drive scheduled work (`render.yaml:113-181`).
- A **transactional ESP** replaces Gmail SMTP (**Target**).
- **Separate** dev and prod databases (**Target**, operational).

## Consequences

**Positive**

- The app can be pointed at the pooled endpoint with a single env change; the
  code already appends `connection_limit`.
- Transaction-scoped locking means the enrollment and scheduler invariants hold
  under PgBouncer without connection pinning.
- The blueprint and runbook make the sizing floor explicit, so a blueprint deploy
  no longer silently lands on the free tier.

**Negative / trade-offs**

- **PgBouncer transaction mode forbids certain features** (session-level
  `SET`, prepared-statement pinning, advisory *session* locks, `LISTEN/NOTIFY`).
  The codebase avoids these, but it is a standing constraint on future work — any
  new feature must be transaction-pooling-safe.
- Reaching the target still requires spend and manual Neon/Render configuration;
  the code cannot enforce that the operator actually set the pooled URL. The
  runbook's pre-launch checklist and `GET /api/health` are the compensating
  controls.
- `connection_limit` must be tuned to (instances × per-instance limit) < Neon's
  pooled cap; getting this wrong reintroduces connection exhaustion. It is
  documented but not automated.

## Alternatives considered

1. **Stay on the direct endpoint and cap Prisma's pool low.** Rejected: it trades
   connection exhaustion for pool-wait timeouts (`P2024`) and does not survive
   multi-instance scale-out. The pooler is the standard Neon answer.
2. **A data-access proxy / Prisma Accelerate.** Overkill for this stage and adds a
   dependency; the Neon `-pooler` provides PgBouncer pooling natively at no extra
   moving part.
3. **Vertical-only scaling (one big instance).** Simpler, but sacrifices
   redundancy and still needs the pooler for burst connections; the two-instance
   Target gives failover for roughly the same money.
