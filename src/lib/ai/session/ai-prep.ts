/**
 * Pre-class prep messages.
 *
 * For each session starting PREP_WINDOW_MIN–PREP_WINDOW_MAX minutes from now,
 * every actively enrolled student gets a short prep note:
 *   - class name, the real minutes-until-start, and the start time in the
 *     student's own timezone (default Asia/Kabul) and locale
 *   - topics they rated an AI answer "not helpful" on for this class (7 days)
 *   - the class's latest materials
 *   - the Meet link
 *
 * Always stored as an in-platform notification; also sent on Telegram when the
 * student linked it AND has not turned Telegram off in their notification
 * preferences.
 *
 * Called by the cron route (src/app/api/cron/ai-prep/route.ts) and by the
 * gated cron pulse. Idempotent: the (dedupeKey, channel) unique index on
 * Notification makes a second run in the same window a no-op per student.
 *
 * Query shape per run: 1 session query (with enrollments), then per session
 * 1 materials + 1 struggled-topics query, then 1 dedupe lookup and 1 insert for
 * the whole run — instead of 3-4 queries per student.
 */

import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/integrations/telegram";

// The window must exceed the hourly cron pulse or sessions slip between runs.
// Originally 25-45, which a pulse longer than 20 minutes jumped straight over.
export const PREP_WINDOW_MIN = 5; // minutes
export const PREP_WINDOW_MAX = 75;

const DEFAULT_TIMEZONE = "Asia/Kabul";

type NotificationPrefs = { telegram?: boolean; webPush?: boolean; email?: boolean };

/** Parse User.notificationPrefs; anything unreadable means "all channels on". */
export function parseNotificationPrefs(raw: string | null | undefined): NotificationPrefs {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as NotificationPrefs) : {};
  } catch {
    return {};
  }
}

/** Wall-clock start time in the student's timezone, in their language's format. */
export function formatPrepTime(start: Date, language: string | null | undefined, timezone?: string | null): string {
  const locale = language === "FA" ? "fa-AF" : "en-US";
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  try {
    return start.toLocaleTimeString(locale, { ...opts, timeZone: timezone || DEFAULT_TIMEZONE });
  } catch {
    // Unknown timezone string on the profile → fall back to Kabul time.
    return start.toLocaleTimeString(locale, { ...opts, timeZone: DEFAULT_TIMEZONE });
  }
}

export function buildPrepMessage(input: {
  className: string;
  studentName: string;
  minutesUntil: number;
  startLabel: string;
  struggledTopics: string[];
  materialTitles: string[];
  meetLink: string | null;
}): string {
  const firstName = input.studentName.split(" ")[0];
  const minutes = Math.max(1, Math.round(input.minutesUntil));

  const lines = [
    `📚 ${input.className} starts in ${minutes} minutes (${input.startLabel})!`,
    "",
    `Hey ${firstName}, quick prep:`,
  ];

  if (input.struggledTopics.length > 0) {
    lines.push(`• Review: ${input.struggledTopics.join(", ")} — you struggled with these recently`);
  }
  if (input.materialTitles.length > 0) {
    lines.push(`• Materials: ${input.materialTitles.join(", ")}`);
  }
  if (input.struggledTopics.length === 0 && input.materialTitles.length === 0) {
    lines.push("• Take a moment to review your last class notes if you have any.");
  }

  if (input.meetLink) {
    lines.push("", `🔗 Join Meet: ${input.meetLink}`);
  }

  return lines.join("\n");
}

/** Top-2 topics by count from comma-separated topic strings. */
export function topTopics(topicLists: Array<string | null>, limit = 2): string[] {
  const counts: Record<string, number> = {};
  for (const list of topicLists) {
    for (const t of (list || "").split(",").filter(Boolean)) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([t]) => t);
}

export async function runAiPrep(now: Date = new Date()): Promise<Record<string, unknown>> {
  const windowStart = new Date(now.getTime() + PREP_WINDOW_MIN * 60 * 1000);
  const windowEnd = new Date(now.getTime() + PREP_WINDOW_MAX * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Find upcoming sessions in the prep window
  const sessions = await prisma.session.findMany({
    where: {
      startTime: { gte: windowStart, lte: windowEnd },
      cancelled: false,
    },
    select: {
      id: true,
      classId: true,
      startTime: true,
      meetLink: true,
      class: {
        select: {
          name: true,
          enrollments: {
            where: { status: "ACTIVE", student: { deactivatedAt: null } },
            select: {
              student: {
                select: {
                  id: true,
                  name: true,
                  language: true,
                  timezone: true,
                  telegramChatId: true,
                  notificationPrefs: true,
                },
              },
            },
          },
        },
      },
    },
  });

  type Pending = {
    userId: string;
    dedupeKey: string;
    content: string;
    telegramChatId: string | null;
  };
  const pending: Pending[] = [];
  const failures: string[] = [];

  for (const session of sessions) {
    const students = session.class.enrollments.map((e) => e.student);
    if (students.length === 0) continue;

    try {
      // One query each per SESSION (not per student).
      const [materials, negatives] = await Promise.all([
        prisma.material.findMany({
          where: { classId: session.classId },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { title: true },
        }),
        prisma.aIInteraction.findMany({
          where: {
            userId: { in: students.map((s) => s.id) },
            createdAt: { gte: sevenDaysAgo },
            rating: "negative",
            classIds: { contains: session.classId },
          },
          select: { userId: true, topics: true },
          take: 500,
        }),
      ]);

      const minutesUntil = (session.startTime.getTime() - now.getTime()) / 60_000;
      for (const student of students) {
        const prefs = parseNotificationPrefs(student.notificationPrefs);
        pending.push({
          userId: student.id,
          dedupeKey: `prep:${session.id}:${student.id}`,
          telegramChatId: prefs.telegram === false ? null : student.telegramChatId,
          content: buildPrepMessage({
            className: session.class.name,
            studentName: student.name,
            minutesUntil,
            startLabel: formatPrepTime(session.startTime, student.language, student.timezone),
            struggledTopics: topTopics(negatives.filter((n) => n.userId === student.id).map((n) => n.topics)),
            materialTitles: materials.map((m) => m.title),
            meetLink: session.meetLink,
          }),
        });
      }
    } catch (err) {
      failures.push(`build:${session.id}: ${(err as Error).message}`);
    }
  }

  if (pending.length === 0) {
    return { sessionsProcessed: sessions.length, sent: 0, skipped: 0, failures };
  }

  // Dedupe: don't send the same prep twice — ONE lookup for the whole run.
  const already = await prisma.notification.findMany({
    where: { dedupeKey: { in: pending.map((p) => p.dedupeKey) } },
    select: { dedupeKey: true },
  });
  const seen = new Set(already.map((n) => n.dedupeKey));
  const fresh = pending.filter((p) => !seen.has(p.dedupeKey));

  // Claim-then-send: insert first (skipDuplicates also absorbs a concurrent
  // run), and only message the students whose row THIS run created.
  const created = fresh.length
    ? await prisma.notification.createManyAndReturn({
        data: fresh.map((p) => ({
          userId: p.userId,
          channel: "PLATFORM" as const,
          content: p.content,
          status: "SENT" as const,
          sentAt: now,
          dedupeKey: p.dedupeKey,
        })),
        skipDuplicates: true,
        select: { dedupeKey: true },
      })
    : [];
  const createdKeys = new Set(created.map((c) => c.dedupeKey));

  for (const p of fresh) {
    if (!createdKeys.has(p.dedupeKey) || !p.telegramChatId) continue;
    try {
      await sendTelegram({ userId: p.userId, telegramChatId: p.telegramChatId }, p.content);
    } catch (err) {
      failures.push(`telegram:${p.userId}: ${(err as Error).message}`);
    }
  }

  return {
    sessionsProcessed: sessions.length,
    sent: createdKeys.size,
    skipped: pending.length - createdKeys.size,
    failures,
  };
}
