# ADR-0004 — Move notification fan-out out of the request path

- **Status:** Partially accepted (request-path removal implemented; durable
  worker/queue + ESP are Target)
- **Date:** 2026-07-18
- **Deciders:** Platform engineering
- **Related:** `src/lib/platform/db-store.ts`, `src/lib/integrations/notifications.ts`,
  `render.yaml`, `src/app/api/cron/*`

## Context

Notifications reach students over a fallback chain — Telegram → Web Push → Email
→ in-platform — because different students use different channels
(`deliverWithFallback`, `notifications.ts:188-241`). Each channel send is wrapped
in a circuit breaker and retry-with-backoff, so a single delivery can take
seconds when a provider is slow.

The original design ran these deliveries **synchronously inside user requests and
inside a single cron HTTP request**:

- The enrollment handler `await`ed sequential, retrying sends for *both* the
  student and the teacher before returning — so a slow provider blocked the HTTP
  response for many seconds.
- `runReminderBatch` was an N+1 loop doing per-student `findFirst` + awaited
  sequential external sends. At the target scale, several classes starting on the
  same hour put hundreds-to-thousands of students in one batch; at ~2 s/student
  serial this exceeds both the Render request timeout **and** the 10-minute
  reminder window itself, so later students silently never get reminded.

The fan-out is, per the capacity audit, the single code path that genuinely needs
re-architecting to reach 10k students; everything else is tier sizing.

## Decision

**Remove synchronous delivery from the user request path immediately, and drive
batch delivery from dedicated cron services rather than user requests. Specify a
durable worker + queue + transactional ESP as the Target throughput design.**

Implemented now:

- **Enrollment deliveries are dispatched after commit, fire-and-forget.** The
  enrollment transaction commits first; notifications are then dispatched via
  `void deliverEnrollmentNotifications(...).catch(...)` **outside** the awaited
  request path (`db-store.ts:1512-1538`). The HTTP response no longer waits on any
  external provider. The response shape retains a `deliveries` key (now empty)
  for stability.
- **Batch work runs on cron services, not user requests.** Reminders (`*/10`) and
  the scheduler (hourly) are triggered by Render **cron** services calling
  `/api/cron/*` with `Authorization: Bearer $CRON_SECRET`
  (`render.yaml:113-139`), so no end user ever waits on a batch.
- **Idempotent retries.** The `Notification` `@@unique([dedupeKey, channel])`
  constraint (`schema.prisma:295`) lets a re-run skip already-sent notifications
  without duplicates, which is what makes moving delivery off the request path
  safe to retry.
- **Atomic scheduler claim.** Overlapping cron runs claim disjoint slices under a
  transaction advisory lock (`db-store.ts:2221-2253`), preventing duplicate
  sessions/notifications when a slow batch outlives its interval.

Target (not yet in code):

- A **dedicated Render Background Worker** consuming a **durable queue**, with
  **bounded-concurrency** delivery (e.g. `Promise.allSettled` at ~20 in flight)
  and **batched dedupe** (one `findMany` of existing dedupe keys per session
  instead of per-student `findFirst`).
- A **transactional ESP** (SES / Postmark / Resend) replacing per-message Gmail
  SMTP, which caps at ~500/day and rebuilds a TLS handshake per message.
- A per-session "reminded" marker (or a widened window) so a slow batch cannot
  skip students.

## Consequences

**Positive**

- User-facing latency (enrollment, and any request that used to trigger a send)
  is decoupled from external provider latency.
- Batch delivery cannot stall a user request or block on the free-tier request
  timeout.
- Idempotency + atomic claiming make retries and overlapping runs safe, which is
  a precondition for any queue-based redesign.

**Negative / trade-offs**

- **Fire-and-forget is not durable.** In a serverless/PaaS runtime that may
  freeze the process after the response, a dispatched-but-not-yet-delivered
  enrollment notification can be lost. This is an explicit interim trade — no send
  ever blocks the user, but at-least-once delivery is not guaranteed until the
  durable queue lands. The code comments mark this as `needs_ops_action`.
- **Throughput is still bounded by the cron invocation** for the reminder batch
  until the worker/queue exists; the per-student N+1 shape is improved by atomic
  claiming but not yet replaced by batched dedupe.
- Gmail SMTP remains permitted, so the 500/day ceiling is still reachable until
  the ESP swap.

## Alternatives considered

1. **Keep sends synchronous but parallelize them in-request.** Rejected: it
   shortens but does not remove the coupling — the request still cannot complete
   until the slowest provider responds, and it concentrates fan-out load on the
   web tier.
2. **A full message broker (SQS/RabbitMQ/BullMQ) now.** The right end state, but
   heavier than warranted for this milestone; the fire-and-forget + cron split
   removes the user-facing harm immediately, and the idempotency/claiming work
   done here is exactly what a queue consumer needs, so no rework is wasted.
3. **Postgres-as-a-queue (`SELECT … FOR UPDATE SKIP LOCKED`).** A strong,
   dependency-light option given we already run Postgres; recorded as the leading
   candidate for the Target worker.
