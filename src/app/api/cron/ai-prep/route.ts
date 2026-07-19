/**
 * GET /api/cron/ai-prep
 *
 * Sends personalized pre-class prep messages to enrolled students
 * for sessions starting in the next 25-45 minutes.
 *
 * Each prep message includes:
 *   - Class name + start time + Meet link
 *   - Topics the student previously struggled with (from learning history)
 *   - Materials to review
 *
 * Sent via Telegram (if linked) and logged as a notification.
 *
 * Runs every 15 min via cron.
 */

import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/integrations/telegram";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

const PREP_WINDOW_MIN = 25; // minutes
const PREP_WINDOW_MAX = 45;

export async function GET(request: Request) {
  const denied = await assertCronAuthorized(request);
  if (denied) return denied;

  const now = new Date();
  const windowStart = new Date(now.getTime() + PREP_WINDOW_MIN * 60 * 1000);
  const windowEnd = new Date(now.getTime() + PREP_WINDOW_MAX * 60 * 1000);

  // Find upcoming sessions in the prep window
  const sessions = await prisma.session.findMany({
    where: {
      startTime: { gte: windowStart, lte: windowEnd },
      cancelled: false,
    },
    include: {
      class: {
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  language: true,
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

  let sentCount = 0;
  let skippedCount = 0;
  const failures: string[] = [];

  for (const session of sessions) {
    for (const enrollment of session.class.enrollments) {
      const student = enrollment.student;

      // Dedupe: don't send the same prep twice
      const dedupeKey = `prep:${session.id}:${student.id}`;
      const existing = await prisma.notification.findFirst({
        where: { userId: student.id, dedupeKey },
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      try {
        const prepMessage = await buildPrepMessage(student.id, session, student.name);

        // Send via Telegram if linked
        if (student.telegramChatId) {
          try {
            await sendTelegram(
              { userId: student.id, telegramChatId: student.telegramChatId },
              prepMessage,
            );
          } catch (err) {
            failures.push(`telegram:${student.id}: ${(err as Error).message}`);
          }
        }

        // Log as in-platform notification
        await prisma.notification.create({
          data: {
            userId: student.id,
            channel: "PLATFORM",
            content: prepMessage,
            status: "SENT",
            sentAt: new Date(),
            dedupeKey,
          },
        });

        sentCount += 1;
      } catch (err) {
        failures.push(`build:${student.id}: ${(err as Error).message}`);
      }
    }
  }

  return Response.json({
    sessionsProcessed: sessions.length,
    sent: sentCount,
    skipped: skippedCount,
    failures,
  });
}

async function buildPrepMessage(
  studentId: string,
  session: {
    id: string;
    startTime: Date;
    meetLink: string | null;
    classId: string;
    class: { name: string };
  },
  studentName: string,
): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get the student's struggled topics from this class
  const interactions = await prisma.aIInteraction.findMany({
    where: {
      userId: studentId,
      createdAt: { gte: sevenDaysAgo },
      classIds: { contains: session.classId },
    },
    select: { topics: true, rating: true },
    take: 30,
  });

  const struggled: Record<string, number> = {};
  for (const i of interactions) {
    if (i.rating !== "negative") continue;
    const topics = (i.topics || "").split(",").filter(Boolean);
    for (const t of topics) {
      struggled[t] = (struggled[t] || 0) + 1;
    }
  }
  const topStruggled = Object.entries(struggled)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([t]) => t);

  // Recent materials
  const materials = await prisma.material.findMany({
    where: { classId: session.classId },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { title: true },
  });

  const startLocal = session.startTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const firstName = studentName.split(" ")[0];

  const lines = [
    `📚 ${session.class.name} starts in ~30 minutes (${startLocal})!`,
    "",
    `Hey ${firstName}, quick prep:`,
  ];

  if (topStruggled.length > 0) {
    lines.push(`• Review: ${topStruggled.join(", ")} — you struggled with these recently`);
  }
  if (materials.length > 0) {
    lines.push(`• Materials: ${materials.map((m) => m.title).join(", ")}`);
  }
  if (topStruggled.length === 0 && materials.length === 0) {
    lines.push("• Take a moment to review your last class notes if you have any.");
  }

  if (session.meetLink) {
    lines.push("", `🔗 Join Meet: ${session.meetLink}`);
  }

  return lines.join("\n");
}
