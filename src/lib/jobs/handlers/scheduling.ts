/**
 * Handler for session.scheduled / session.rescheduled events: notify the class's
 * enrolled students of the new/changed time. Enqueued by the event bus and run in
 * the worker (delivery is at-least-once, so the message is idempotent-friendly).
 */

import { deliverWithFallback } from "@/lib/integrations/notifications";
import { prisma } from "@/lib/prisma";

type Recipient = {
  id: string;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  pushSubscription: string | null;
};

const studentSelect = {
  id: true,
  email: true,
  phone: true,
  telegramChatId: true,
  pushSubscription: true,
} as const;

async function fanOut(recipients: Recipient[], content: string, concurrency = 8): Promise<number> {
  let failures = 0;
  for (let i = 0; i < recipients.length; i += concurrency) {
    const batch = recipients.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((r) =>
        deliverWithFallback(
          { userId: r.id, email: r.email, phone: r.phone, telegramChatId: r.telegramChatId, pushSubscription: r.pushSubscription },
          content,
        ),
      ),
    );
    for (const res of results) {
      if (res.status === "rejected" || !res.value.some((d) => d.status === "SENT")) failures += 1;
    }
  }
  return failures;
}

export async function notifySessionScheduled(payload: Record<string, unknown>): Promise<void> {
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  const kind = payload.kind === "rescheduled" ? "rescheduled" : "scheduled";
  if (!sessionId) return;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      startTime: true,
      meetLink: true,
      cancelled: true,
      class: {
        select: {
          name: true,
          enrollments: {
            where: { status: "ACTIVE" },
            select: { student: { select: studentSelect } },
          },
        },
      },
    },
  });

  // Entity gone or cancelled between enqueue and run ⇒ nothing to do.
  if (!session || session.cancelled) return;

  const recipients = session.class.enrollments.map((e) => e.student);
  if (recipients.length === 0) return;

  const when = session.startTime.toISOString();
  const link = session.meetLink ?? "Meet link pending";
  const verb = kind === "rescheduled" ? "has been rescheduled to" : "is scheduled for";
  const content = `Your class "${session.class.name}" ${verb} ${when}. Join: ${link}`;

  const failures = await fanOut(recipients, content);
  if (failures > 0) {
    throw new Error(`session ${kind} notification failed for ${failures}/${recipients.length} student(s)`);
  }
}
