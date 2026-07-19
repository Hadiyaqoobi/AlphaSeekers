/**
 * Notification-oriented job handlers.
 *
 * Every handler is a `JobHandler` (payload, ctx) => Promise<void>. On a genuine
 * failure it THROWS so the queue retries with backoff; when the referenced
 * entity is simply gone (deleted between enqueue and run) it returns quietly,
 * because retrying can never make a deleted row reappear.
 *
 * All outbound delivery goes through `deliverWithFallback`, which walks the
 * channel chain Telegram → Web Push → Email → Platform and only rejects if every
 * channel — including the always-on platform fallback — fails. `deliverOrThrow`
 * turns that "nothing landed" case into a throw so the job retries.
 */

import { Prisma } from "@prisma/client";

import { deliverWithFallback, type NotificationTarget } from "@/lib/integrations/notifications";
import { prisma } from "@/lib/prisma";

// ─── Shared helpers ─────────────────────────────────────────────────────────

/** The minimal User columns every notification needs to pick a channel. */
export const notifiableSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  telegramChatId: true,
  pushSubscription: true,
  notificationPrefs: true,
} satisfies Prisma.UserSelect;

/** A user row shaped for delivery (superset-compatible with `notifiableSelect`). */
export type NotifiableRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  telegramChatId?: string | null;
  pushSubscription?: string | null;
  notificationPrefs?: string | null;
};

export function toTarget(row: NotifiableRow): NotificationTarget {
  return {
    userId: row.id,
    email: row.email ?? null,
    phone: row.phone ?? null,
    telegramChatId: row.telegramChatId ?? null,
    pushSubscription: row.pushSubscription ?? null,
    notificationPrefs: row.notificationPrefs ?? null,
  };
}

/**
 * Deliver to a single target, throwing if delivery FULLY fails. `deliverWithFallback`
 * ends on the platform fallback (which cannot be disabled and always records a
 * SENT), so in practice this only throws if that last resort itself failed —
 * exactly the state where a retry is warranted.
 */
export async function deliverOrThrow(target: NotificationTarget, content: string): Promise<void> {
  const deliveries = await deliverWithFallback(target, content);
  const landed = deliveries.some((d) => d.status === "SENT");
  if (!landed) {
    throw new Error(`Notification delivery fully failed for user ${target.userId}`);
  }
}

/**
 * Fan out one message to many recipients with BOUNDED CONCURRENCY (batches of
 * `concurrency`, default 8) using Promise.allSettled so one bad recipient never
 * aborts the rest. Returns the count of recipients whose delivery fully failed.
 */
export async function deliverToMany(
  rows: NotifiableRow[],
  content: string,
  concurrency = 8,
): Promise<number> {
  let failures = 0;
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((row) => deliverOrThrow(toTarget(row), content)));
    for (const outcome of settled) {
      if (outcome.status === "rejected") failures += 1;
    }
  }
  return failures;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function formatWhen(date: Date): string {
  // Stable UTC rendering keeps the message text idempotent across retries.
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/**
 * "send_notification" — direct, ad-hoc delivery.
 * payload: { userId, email?, phone?, telegramChatId?, pushSubscription?, content }
 */
export async function sendNotification(payload: Record<string, unknown>): Promise<void> {
  const userId = str(payload.userId);
  const content = str(payload.content);
  // Missing routing/content is a malformed enqueue, not a transient fault — a
  // retry can never fix it, so return quietly rather than churn to dead-letter.
  if (!userId || !content) return;

  const target: NotificationTarget = {
    userId,
    email: strOrNull(payload.email),
    phone: strOrNull(payload.phone),
    telegramChatId: strOrNull(payload.telegramChatId),
    pushSubscription: strOrNull(payload.pushSubscription),
  };

  await deliverOrThrow(target, content);
}

/**
 * "welcome_student" — greet a newly enrolled student.
 * payload: { studentId, classId }
 */
export async function welcomeStudent(payload: Record<string, unknown>): Promise<void> {
  const studentId = str(payload.studentId);
  const classId = str(payload.classId);
  if (!studentId || !classId) return;

  const [student, klass] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, select: notifiableSelect }),
    prisma.class.findUnique({ where: { id: classId }, select: { name: true, whatsappGroupUrl: true } }),
  ]);
  // Either side may have been deleted between enrollment and this run.
  if (!student || !klass) return;

  const whatsapp = (klass as { whatsappGroupUrl?: string | null }).whatsappGroupUrl?.trim();
  const content =
    `Welcome to "${klass.name}"! You're all set. ` +
    `You'll get reminders before each session and can join from your dashboard. ` +
    (whatsapp ? `Join the class WhatsApp group: ${whatsapp} ` : "") +
    `We're glad to have you.`;

  await deliverOrThrow(toTarget(student), content);
}

/**
 * "welcome_teacher" — tell a class teacher that a new student just enrolled.
 * payload: { studentId, classId }
 *
 * Mirrors the message db-store used to send inline; it is now the sole
 * teacher-side enrollment notification and is driven by the event bus (the
 * student welcome is handled separately by `welcome_student`). Best-effort:
 * returns quietly if the class, its teacher, or the student has since been
 * deleted, since a retry cannot resurrect a missing row.
 */
export async function welcomeTeacher(payload: Record<string, unknown>): Promise<void> {
  const studentId = str(payload.studentId);
  const classId = str(payload.classId);
  if (!studentId || !classId) return;

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      name: true,
      maxStudents: true,
      teacher: { select: { ...notifiableSelect, language: true } },
    },
  });
  // The class or its teacher may have been removed since enrollment.
  if (!klass || !klass.teacher) return;

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { name: true },
  });
  if (!student) return;

  // Current active headcount for the class (this enrollment is already committed).
  const activeCount = await prisma.enrollment.count({
    where: { classId, status: "ACTIVE" },
  });

  const content =
    klass.teacher.language === "FA"
      ? `شاگرد جدید "${student.name}" در صنف "${klass.name}" ثبت‌نام کرد. (${activeCount}/${klass.maxStudents})`
      : `New student "${student.name}" enrolled in "${klass.name}". (${activeCount}/${klass.maxStudents} enrolled)`;

  await deliverOrThrow(toTarget(klass.teacher), content);
}

/**
 * "welcome_employee" — notify a freshly provisioned staff account.
 * payload: { employeeId }
 *
 * NEVER includes a password: the temporary password is not available here and
 * must not be embedded in a notification.
 */
export async function welcomeEmployee(payload: Record<string, unknown>): Promise<void> {
  const employeeId = str(payload.employeeId);
  if (!employeeId) return;

  const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: notifiableSelect });
  if (!employee) return;

  const content =
    `Hi ${employee.name ?? "there"}, your AlphaSeekers staff account has been created. ` +
    `Log in with your work email and set a new password on first sign-in. ` +
    `For your security this message contains no password — use the temporary one your administrator gave you directly.`;

  await deliverOrThrow(toTarget(employee), content);
}

/**
 * "session_reminder" — remind every actively enrolled student a session is soon.
 * payload: { sessionId }
 *
 * Fans out with bounded concurrency; if any recipient fully failed we throw so
 * the whole job retries. Retries may re-notify, so the message is kept generic
 * and idempotent-friendly (no "reminder #N", no per-attempt state).
 */
export async function sessionReminder(payload: Record<string, unknown>): Promise<void> {
  const sessionId = str(payload.sessionId);
  if (!sessionId) return;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      cancelled: true,
      startTime: true,
      class: {
        select: {
          name: true,
          enrollments: {
            where: { status: "ACTIVE" },
            select: { student: { select: notifiableSelect } },
          },
        },
      },
    },
  });

  // Cancelled or deleted session, or an orphaned class: nothing to send.
  if (!session || session.cancelled || !session.class) return;

  const students: NotifiableRow[] = session.class.enrollments.map((e) => e.student);
  if (students.length === 0) return;

  const content =
    `Reminder: your class "${session.class.name}" starts at ${formatWhen(session.startTime)}. ` +
    `Join from your dashboard a few minutes early.`;

  const failures = await deliverToMany(students, content, 8);
  if (failures > 0) {
    throw new Error(
      `session_reminder: ${failures}/${students.length} reminders failed for session ${sessionId}`,
    );
  }
}

/**
 * "notify_homework_submitted" — tell the class teacher a submission arrived.
 * payload: { homeworkId } (a HomeworkSubmission id) OR { sessionId, studentId }.
 */
export async function notifyHomeworkSubmitted(payload: Record<string, unknown>): Promise<void> {
  const homeworkId = str(payload.homeworkId);
  const sessionId = str(payload.sessionId);
  let studentId = str(payload.studentId);

  let teacher: NotifiableRow | null = null;
  let className: string | null = null;
  let assignmentTitle: string | null = null;

  if (homeworkId) {
    const submission = await prisma.homeworkSubmission.findUnique({
      where: { id: homeworkId },
      select: {
        studentId: true,
        assignment: {
          select: {
            title: true,
            // No direct Class relation on HomeworkAssignment; reach it via session.
            session: {
              select: {
                class: { select: { name: true, teacher: { select: notifiableSelect } } },
              },
            },
          },
        },
      },
    });
    if (!submission) return;
    const klass = submission.assignment?.session?.class ?? null;
    if (!klass) return;
    teacher = klass.teacher;
    className = klass.name;
    assignmentTitle = submission.assignment?.title ?? null;
    studentId = studentId ?? submission.studentId;
  } else if (sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { class: { select: { name: true, teacher: { select: notifiableSelect } } } },
    });
    const klass = session?.class ?? null;
    if (!klass) return;
    teacher = klass.teacher;
    className = klass.name;
  } else {
    // Neither identifier supplied — malformed payload; nothing to do.
    return;
  }

  if (!teacher) return;

  let studentName = "A student";
  if (studentId) {
    const student = await prisma.user.findUnique({ where: { id: studentId }, select: { name: true } });
    if (student?.name) studentName = student.name;
  }

  const forHomework = assignmentTitle ? ` for "${assignmentTitle}"` : "";
  const forClass = className ? ` in "${className}"` : "";
  const content =
    `${studentName} submitted homework${forHomework}${forClass}. ` +
    `Open your teacher dashboard to review and grade it.`;

  await deliverOrThrow(toTarget(teacher), content);
}

/**
 * "notify_moderation_queued" — alert admins that a post awaits review.
 * payload: { postId }
 *
 * Keeps it simple: notifies active ADMIN-role users. Returns quietly if the post
 * is gone or there are no admins to notify.
 */
export async function notifyModerationQueued(payload: Record<string, unknown>): Promise<void> {
  const postId = str(payload.postId);
  if (!postId) return;

  const post = await prisma.studentPost.findUnique({
    where: { id: postId },
    select: { title: true, type: true },
  });
  if (!post) return;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", deactivatedAt: null },
    select: notifiableSelect,
  });
  if (admins.length === 0) return;

  const content =
    `A ${post.type} post "${post.title}" is awaiting moderation. ` +
    `Open the moderation queue to approve or reject it.`;

  const failures = await deliverToMany(admins, content, 8);
  if (failures > 0) {
    throw new Error(
      `notify_moderation_queued: ${failures}/${admins.length} admin notifications failed for post ${postId}`,
    );
  }
}
