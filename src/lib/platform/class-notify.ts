import { prisma } from "@/lib/prisma";
import { deliverWithFallback } from "@/lib/integrations/notifications";

/**
 * Tell a teacher a class has been assigned to them, and what they must do before
 * it can run.
 *
 * This exists because a class created from the admin screen used to trigger
 * nothing at all: the teacher was never told, never set their availability, and
 * the scheduler therefore skipped the class forever. Two English classes were
 * advertised publicly in August 2026 with zero sessions for exactly this reason.
 *
 * Deliberately does NOT create sessions. createClassWithSession() guesses a time
 * from the free-text schedulePreference when a teacher has no availability, which
 * is the behaviour the scheduler explicitly refuses (QA 2026-04-19: never book a
 * teacher into an hour they never agreed to). Sessions are the scheduler's job,
 * once real availability exists.
 *
 * English only. Dari is never machine-written here -- see the translation debt
 * note in the project docs; a Dari version needs a human translator.
 */
export async function notifyTeacherOfNewClass(input: {
  classId: string;
  className: string;
  teacherId: string;
  schedulePreference?: string | null;
}): Promise<void> {
  const teacher = await prisma.user.findUnique({
    where: { id: input.teacherId },
    select: {
      id: true,
      email: true,
      phone: true,
      telegramChatId: true,
      pushSubscription: true,
    },
  });

  if (!teacher) return;

  const base = (process.env.APP_BASE_URL ?? "https://alphaseekers.org").replace(/\/$/, "");

  // One link, to a page that shows the teacher their own live status rather than
  // generic instructions — it ticks each step off as they complete it.
  const content = [
    `You have been assigned a new class: "${input.className}".`,
    input.schedulePreference ? `Planned schedule: ${input.schedulePreference}` : null,
    "",
    "Two steps before it can run:",
    "1. Set the hours you can teach.",
    "2. Connect your Google account, so each session gets a Meet link.",
    "",
    `Both are here: ${base}/en/teacher/setup`,
    "",
    "Your sessions are created automatically once both are done.",
    "Until then the class has no session times and students cannot join.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const deliveries = await deliverWithFallback(
    {
      userId: teacher.id,
      email: teacher.email,
      phone: teacher.phone,
      telegramChatId: teacher.telegramChatId,
      pushSubscription: teacher.pushSubscription,
    },
    content,
  );

  if (deliveries.length === 0) return;

  // dedupeKey keeps a retried or duplicated creation from mailing the teacher twice.
  await prisma.notification.createMany({
    data: deliveries.map((delivery) => ({
      userId: teacher.id,
      dedupeKey: `class_assigned:${input.classId}:${teacher.id}`,
      channel: delivery.channel,
      content,
      status: delivery.status,
      sentAt: new Date(),
    })),
    skipDuplicates: true,
  });
}
