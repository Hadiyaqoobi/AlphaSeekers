# ADR-0001 — Remove the silent database→memory fallback

- **Status:** Accepted (implemented)
- **Date:** 2026-07-18
- **Deciders:** Platform engineering
- **Related:** `src/lib/platform/store.ts`, `src/lib/runtime.ts`,
  `src/lib/platform/db-store.ts`, `src/app/api/health/route.ts`

## Context

The data layer sat behind a `store.ts` facade that dispatched to a Postgres
implementation (`db-store.ts`) or an in-memory mock (`memory-store.ts`). The
original facade wrapped every operation — reads **and** writes — in a single
`try/catch` that, on *any* thrown error, logged a warning, latched a
process-global `databaseMode = false`, and re-ran the operation against the
memory store. Two properties made this disqualifying for a real deployment:

1. **It could not distinguish a database outage from an ordinary business-rule
   rejection.** A routine `throw new Error("Class is full")` on a full-class
   enrollment propagated into the same catch, flipping the process into mock
   mode. At the target scale, full classes are the steady state, so fallback
   engagement was a near-certainty within minutes of launch.
2. **The latch was permanent and the writes were lost.** Once flipped, the
   process served seeded mock data and accepted writes into process RAM that
   returned `200 OK` and then evaporated on the next spin-down — silent,
   unrecoverable data loss. The mode was never re-probed, and multi-instance
   deployments would split-brain independently.

Compounding this, `runtime.ts` defaulted the whole application to *demo* mode
even under `NODE_ENV=production`, so on the deployed Render service the fallback
(plus demo auth, auto-seed, and mock Meet links) was **armed by default**.

## Decision

**Split the fallback into an explicit read path and write path, forbid the write
path from ever falling back in production, classify errors, and make the mode
cache a short-lived probe rather than a permanent latch. Independently, make the
runtime default *safe*.**

Implemented in `store.ts`:

- **`runWrite` (writes) is database-only when a database is authoritative**
  (`store.ts:118-148`). On an infrastructure error it invalidates the
  availability cache and **rethrows**, so the API returns 5xx and the client can
  retry against the real database. The only fallback is demo/dev with *no*
  configured database, where memory legitimately is the backend of record.
- **`runWithFallback` (reads) may serve memory only when
  `runtime.allowDbFallback` is true** (`store.ts:73-107`) — which is false in
  production. Reads are non-destructive, so a stale/mock read during a transient
  blip is acceptable in demo only.
- **Error classification** (`isBusinessRuleError`, `store.ts:45-62`): messages
  like `not found`, `is full`, `already`, `not enrolled` propagate to the caller
  as domain errors and never trigger a fallback or re-probe. Only genuine infra
  errors touch the availability cache.
- **The mode is a 30-second cache, not a latch** (`store.ts:10-38`):
  `shouldUseDatabase()` re-probes after `AVAILABILITY_PROBE_TTL_MS`, and any infra
  error calls `invalidateDatabaseModeCache()` so the very next call re-probes.

Implemented in `runtime.ts`:

- `normalizeMode()` derives a **safe default from `NODE_ENV`**: an unset/unknown
  `ALPHASEEKERS_MODE` resolves to `production` when `NODE_ENV=production`
  (`runtime.ts:16-19`).
- `warnIfInsecureProductionConfig()` **throws at boot** (fails the deploy) if a
  production build has any insecure demo toggle enabled, unless the operator sets
  an explicit `ALPHASEEKERS_I_KNOW_THIS_IS_DEMO=true` override
  (`runtime.ts:70-79`).
- `render.yaml` sets `ALPHASEEKERS_MODE=production` explicitly (`render.yaml:30`),
  belt-and-suspenders with the safe default.

## Consequences

**Positive**

- A transient Neon blip degrades to retryable 5xx, not silent data loss. Writes
  are never accepted into a store that will discard them.
- Business-rule rejections behave correctly (4xx) and no longer poison the
  process.
- A recovered database self-heals within ~30 s (cache TTL) instead of requiring a
  redeploy.
- Production cannot boot with demo escape hatches armed; the failure is loud (a
  thrown error at startup) instead of a buried `console.warn`.
- `GET /api/health` treats the DB as required in production and returns `503`
  when it is unreachable, giving uptime monitors a real signal.

**Negative / trade-offs**

- In a genuine outage, production now returns errors rather than a degraded-but-
  up experience. This is the correct trade for a system of record, but it makes
  database availability a hard dependency — hence the pooling and health-check
  work in [ADR-0003](./0003-neon-connection-pooling-and-scaling.md).
- The dual `db-store`/`memory-store` implementations remain (demo mode still
  needs the mock). That duplication is now the largest maintenance cost of
  keeping demo mode at all (see ARCHITECTURE.md §10).

## Alternatives considered

1. **Keep the fallback but restrict it to a read-only allowlist.** Rejected:
   still serves fabricated data as if real during an incident, and the
   split-brain/multi-instance problem remains. The read path already limits
   memory to demo mode, which is sufficient.
2. **Typed domain-error classes instead of message matching.** A cleaner
   long-term design (`class DomainError extends Error`). Deferred: message
   classification was a smaller, well-tested change across an already-large
   surface; typed errors are a good follow-up but not required for correctness.
3. **Delete demo/memory mode entirely.** Tempting, but demo mode is genuinely
   useful for local development and stakeholder demos without a database. Kept,
   but firewalled from production by `allowDbFallback`.
