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
 * Deliberately does NOT create sessions. Booking follows one rule everywhere
 * (src/lib/scheduling/weekly-slot.ts): the posted class time, and only once it is
 * inside the teacher's availability (QA 2026-04-19: never book a teacher into an
 * hour they never agreed to).
 *
 * English only. Dari is never machine-written here -- see the translation debt
 * note in the project docs; a Dari version needs a human translator.
 */
export async function notifyTeacherOfNewClass(input: {
  classId: string;
  className: string;
  teacherId: string;
  schedulePreference?: string | null;
  /** MANUAL classes get no automatic sessions, so the message must not promise them. */
  schedulingMode?: "AUTO" | "MANUAL";
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

  // MANUAL: the teacher sets every date. Pointing them at availability (and
  // promising automatic sessions) left manual classes with no sessions at all.
  const manualContent = [
    `You have been assigned a new class: "${input.className}".`,
    input.schedulePreference ? `Planned schedule: ${input.schedulePreference} (Kabul time)` : null,
    "",
    "You set the date and time of each session yourself — nothing is created automatically.",
    "",
    `Add your sessions here: ${base}/en/teacher/classes/${input.classId}/schedule`,
    "",
    "Until you add a session, students have nothing to join. Each session you add gets a Meet link.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  // One link, to a page that shows the teacher their own live status rather than
  // generic instructions — it ticks each step off as they complete it.
  const autoContent = [
    `You have been assigned a new class: "${input.className}".`,
    input.schedulePreference ? `Planned schedule: ${input.schedulePreference}` : null,
    "",
    "One step before it can run: set the hours you can teach.",
    "",
    `Set them here: ${base}/en/teacher/setup`,
    "",
    "Your sessions are then created automatically at the class time above (Kabul time),",
    "as long as that time is inside the hours you set.",
    "Until then the class has no session times and students cannot join.",
    "",
    "You can also connect your Google account on that page if you want the Meet",
    "invitation in your own calendar. That part is optional — sessions get a Meet",
    "link either way.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const content = input.schedulingMode === "MANUAL" ? manualContent : autoContent;

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
