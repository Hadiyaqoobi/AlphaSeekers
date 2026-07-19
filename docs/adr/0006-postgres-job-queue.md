# ADR-0006 — A Postgres-backed job queue and event bus

- **Status:** Accepted (implemented)
- **Date:** 2026-07-18
- **Deciders:** Platform engineering
- **Related:** `src/lib/jobs/queue.ts`, `src/lib/jobs/worker.ts`,
  `src/lib/jobs/handlers/*`, `src/lib/events/bus.ts`, `render.yaml`,
  `src/app/api/cron/worker`, ADR-0004 (notification fan-out out of the request path)

## Context

ADR-0004 removed synchronous notification fan-out from the user request path but
left the interim delivery mechanism as **fire-and-forget** (`void promise.catch`)
plus cron-triggered batch loops. Its own "Negative" section calls this out: a
dispatched-but-not-yet-delivered side effect can be lost if the process freezes
after responding, and it explicitly names a durable queue as the missing piece
and Postgres-as-a-queue (`SELECT … FOR UPDATE SKIP LOCKED`) as the leading
candidate. This ADR records the decision to build that queue.

The requirements for the automation layer:

- **Durability** — a side effect that has been decided on (send welcome message,
  notify teacher of a submission, queue a post for moderation) must survive a
  process restart, not live only in an in-memory promise.
- **Retries with backoff and a dead-letter sink** — external providers (Telegram,
  Web Push, SMTP) fail transiently; a failed attempt must be retried, and a
  persistently failing job must land somewhere a human can inspect it rather than
  vanish or spin forever.
- **Idempotency** — schedulers and the reminder loop run on a fixed interval and
  can overlap; enqueuing the same logical unit of work twice must not double-send.
- **Decoupling producers from consumers** — a request handler that causes a side
  effect (enrollment, employee provisioning) should not know or care which
  handlers run, nor wait on them.
- **No new infrastructure** — the platform already runs on Neon Postgres (see
  ADR-0003) and a single Render web service; the capacity audit concluded the
  fan-out path, not the broker, is what needs re-architecting. Adding a Redis /
  SQS / RabbitMQ dependency would mean another managed service to provision,
  secure, monitor, and pay for.

## Decision

**Build the job queue on Postgres and layer a fan-out-to-queue event bus on top.
Do not introduce an external broker.**

### 1. Postgres-backed queue (`src/lib/jobs/queue.ts`)

A `Job` table is the queue. Jobs carry `type`, JSON `payload`, `runAt`,
`priority`, `attempts` / `maxAttempts`, an optional `dedupeKey`, `status`
(`PENDING` / `ACTIVE` / `COMPLETED` / `FAILED` / `DEAD`), and `lockedAt` /
`lockedBy` / `lastError`.

- **Concurrent-safe claiming via `FOR UPDATE SKIP LOCKED`.** `claim()` runs a
  single `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED LIMIT n)` that
  flips due rows to `ACTIVE` and stamps `lockedBy`. `SKIP LOCKED` lets N workers
  (or N overlapping cron drains) pull disjoint batches without ever handing the
  same job to two workers and without blocking on each other's locked rows. Time
  is computed as `now() AT TIME ZONE 'UTC'` in SQL to match Prisma's UTC-naive
  `timestamp` storage exactly, avoiding a session-timezone "now" shift.
- **Exponential backoff + dead-letter.** `markFailed()` increments `attempts`,
  and while `attempts < maxAttempts` reschedules the job into the future via
  `backoffSeconds()` (10s → 30s → 2m → 10m → 30m → 1h, capped). Once attempts are
  exhausted the job goes to `DEAD` with its last error preserved for human
  inspection — it is not retried and not silently dropped.
- **Idempotency via `dedupeKey`.** `enqueue()` skips creating a job when a *live*
  job (`PENDING` / `ACTIVE` / `FAILED`) already holds the same `dedupeKey`, and
  treats a unique-constraint race (`P2002`) as a dedupe hit. This is what lets a
  scheduler fire every minute, or a user double-click enrollment, without
  producing duplicate work.
- **Stall recovery.** `reapStalled()` flips jobs stuck in `ACTIVE` past a
  staleness cutoff back to `FAILED` so a crashed worker's in-flight jobs get
  retried rather than stranded.

### 2. Worker (`src/lib/jobs/worker.ts`)

`registerHandler(type, handler)` populates an in-process registry (handlers live
in `src/lib/jobs/handlers`, imported before draining). `drainOnce()` claims a
batch and dispatches each job to its handler: success → `markCompleted`, a thrown
error → `markFailed` (retry or dead-letter). An unknown job type is treated as a
failure, so a missing-handler misconfiguration surfaces in the dead-letter sink
instead of quietly disappearing. The **same core runs in two modes** (see below).

### 3. Event bus (`src/lib/events/bus.ts`) — fan-out to the queue

Producers call `emit(event, payload, opts)`. A static `SUBSCRIPTIONS` map takes
each domain event to zero-or-more handler job types, and `emit()` **enqueues one
durable Job per subscriber** rather than invoking anything in-process. This is
deliberately a fan-out-to-queue design, not an in-memory `EventEmitter`: the
whole point (continuing ADR-0004) is that side effects leave the request path and
run in the worker with the queue's durability and retry semantics. Current
subscriptions:

| Event | Handler job(s) |
| --- | --- |
| `student.enrolled` | `welcome_student` |
| `session.starting_soon` | `session_reminder` |
| `homework.submitted` | `notify_homework_submitted` |
| `post.pending_review` | `notify_moderation_queued` |
| `employee.provisioned` | `welcome_employee` |

Per-subscriber dedupe keys are derived as `${dedupeKey}:${handlerType}`, so a
producer passing `dedupeKey: "enrolled:<studentId>:<classId>"` gets idempotency
across the whole fan-out. Producers (the enrollment route, the super-admin
employee route) wrap `emit()` in `try/catch` and only log on failure, so a queue
hiccup can never break or roll back the user action that triggered it.

### 4. Two worker run modes (`render.yaml`)

- **Now — per-minute cron drain.** A Render `cron` service POSTs
  `/api/cron/worker` (authorized with the `CRON_SECRET` bearer) every minute; the
  endpoint calls `drainOnce()`. This needs no extra always-on service and fits the
  current single-web-service deployment. Reminders and the scheduler crons now
  only *enqueue* jobs; this drain performs the actual work.
- **At scale — dedicated Background Worker.** A Render `worker` service running the
  long-lived `runWorker()` polling loop, which claims jobs the instant they are
  due, keeps draining while work exists, and periodically reaps stalled jobs.
  Because claiming is `FOR UPDATE SKIP LOCKED`, multiple replicas run safely. This
  is documented as a commented block in `render.yaml`; switching modes is swapping
  the cron for the worker service, with no application-code change.

## Consequences

**Positive**

- Side effects are now **durable**: they are committed queue rows, not in-memory
  promises, closing the fire-and-forget durability gap ADR-0004 flagged.
- **Retries, backoff, and dead-lettering** come for free to every handler, and a
  poison job ends up in `DEAD` for inspection instead of looping or vanishing.
- **Idempotency** via `dedupeKey` makes overlapping schedulers and double-submits
  safe by construction.
- The queue is **transactional with application data** — same Neon database, same
  connection pool (ADR-0003) — so there is no cross-system consistency gap and no
  new service to provision, secure, or monitor. Zero new npm dependencies.
- Producers and consumers are fully **decoupled**; adding a new side effect to an
  event is a one-line `SUBSCRIPTIONS` edit plus a handler registration.
- Migrating from cron drain to a dedicated worker is a **deployment change only**.

**Negative / trade-offs**

- **Polling latency.** The cron drain adds up to ~60s before a job runs. Fine for
  emails/reminders; the dedicated-worker mode removes it when latency matters.
- **At-least-once delivery.** A worker can crash after a handler's side effect but
  before `markCompleted`, so the job is reaped and re-run. **Handlers must tolerate
  re-delivery** — make external effects idempotent (e.g. the `Notification`
  `@@unique([dedupeKey, channel])` constraint from ADR-0004 lets a resend skip an
  already-sent message). This is an accepted, documented property, not a bug.
- **The database carries queue load.** Claim polling and job churn add write and
  vacuum pressure to Postgres. At current volume this is negligible and shares the
  already-warm Neon compute; a broker only becomes worth its operational cost at
  far higher throughput.
- **In-process handler registry.** Any process that drains must import the handler
  module first; an unregistered type dead-letters (surfaced), which is the safe
  failure but still requires the registry to be wired at startup.

## Alternatives considered

1. **Redis + BullMQ.** The conventional Node choice. Rejected for this milestone:
   it adds a managed Redis instance to provision, secure, monitor, and pay for,
   and puts the queue in a *different* datastore than the app's data — so
   enqueue-with-commit is no longer atomic. The volume that would justify it is
   well beyond current scale.
2. **SQS / a hosted broker.** Durable and scalable, but the same "new
   infrastructure + non-transactional with app writes + vendor coupling" cost, for
   throughput we do not yet need.
3. **In-process `EventEmitter` / `setImmediate`.** Zero infrastructure, but no
   durability, no retries, no cross-instance delivery — exactly the fire-and-forget
   weakness ADR-0004 set out to remove. Rejected.
4. **Keep fire-and-forget + cron batch loops (the ADR-0004 interim).** Already
   shown to lose work on process freeze and to bound throughput by the cron
   invocation. This ADR is the planned replacement.
5. **Postgres `LISTEN`/`NOTIFY` for wakeups.** Could cut polling latency, but adds
   a persistent listener connection and complexity; the dedicated-worker loop
   already gives low latency when needed, so deferred.
