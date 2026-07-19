/**
 * Lightweight, durable event bus.
 *
 * Producers `emit()` domain events (student.enrolled, session.starting_soon,
 * homework.submitted, ...). Each event type maps to zero or more handler job
 * types; emitting enqueues one durable Job per subscriber, so delivery survives
 * restarts and gets the queue's retry/backoff semantics. Producers stay fully
 * decoupled from consumers.
 *
 * This is intentionally a fan-out-to-queue design rather than an in-process
 * emitter: the whole point is that side effects (emails, push, scheduling) leave
 * the request path and run in the worker.
 */

import { enqueue } from "@/lib/jobs/queue";

export type DomainEvent =
  | "student.enrolled"
  | "student.dropped"
  | "session.starting_soon"
  | "session.scheduled"
  | "session.rescheduled"
  | "homework.submitted"
  | "post.pending_review"
  | "employee.provisioned";

/** Maps an event to the handler job types that should run when it fires. */
const SUBSCRIPTIONS: Record<DomainEvent, string[]> = {
  "student.enrolled": ["welcome_student", "welcome_teacher"],
  "student.dropped": [],
  "session.starting_soon": ["session_reminder"],
  "session.scheduled": ["notify_session_scheduled"],
  "session.rescheduled": ["notify_session_scheduled"],
  "homework.submitted": ["notify_homework_submitted"],
  "post.pending_review": ["notify_moderation_queued"],
  "employee.provisioned": ["welcome_employee"],
};

export type EmitOptions = {
  /** Base idempotency key; each subscriber job gets `${dedupeKey}:${handler}`. */
  dedupeKey?: string;
  /** Delay before the resulting jobs become due. */
  runAt?: Date;
  priority?: number;
};

/**
 * Emit a domain event: enqueue a job for each subscribed handler. Returns the
 * enqueued job ids. Safe to call inside a request — it only writes queue rows and
 * does not perform the side effects itself.
 */
export async function emit(
  event: DomainEvent,
  payload: Record<string, unknown> = {},
  options: EmitOptions = {},
): Promise<string[]> {
  const subscribers = SUBSCRIPTIONS[event] ?? [];
  const ids: string[] = [];

  for (const handlerType of subscribers) {
    const { id } = await enqueue(
      handlerType,
      { event, ...payload },
      {
        runAt: options.runAt,
        priority: options.priority,
        dedupeKey: options.dedupeKey ? `${options.dedupeKey}:${handlerType}` : undefined,
      },
    );
    ids.push(id);
  }

  return ids;
}

export function subscribersFor(event: DomainEvent): string[] {
  return SUBSCRIPTIONS[event] ?? [];
}
