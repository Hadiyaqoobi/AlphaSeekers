/**
 * GET /api/me/learning-stats
 *
 * Returns personalized learning analytics for the student:
 * daily activity, mode distribution, top topics, vocabulary count, streak.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [dailyActivityRaw, modeDistribution, topicsData, vocabCount, totalInteractions] =
    await Promise.all([
      prisma.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(
        `SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') as date, COUNT(*)::bigint as count
         FROM "AIInteraction"
         WHERE "userId" = $1 AND "createdAt" >= $2
         GROUP BY DATE("createdAt")
         ORDER BY date ASC`,
        user.id,
        thirtyDaysAgo,
      ),

      prisma.aIInteraction.groupBy({
        by: ["mode"],
        where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),

      prisma.aIInteraction.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: thirtyDaysAgo },
          topics: { not: null },
        },
        select: { topics: true },
      }),

      prisma.spacedRepetitionItem.count({
        where: { userId: user.id },
      }),

      prisma.aIInteraction.count({
        where: { userId: user.id },
      }),
    ]);

  // Normalize daily activity
  const dailyActivity = dailyActivityRaw.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));

  // Top topics
  const allTopics = topicsData.flatMap((t) => (t.topics || "").split(",").filter(Boolean));
  const topicCounts: Record<string, number> = {};
  for (const topic of allTopics) {
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  }
  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([topic, count]) => ({ topic, count }));

  // Streak calculation — consecutive days with at least 1 question
  const activeDays = new Set(dailyActivity.map((d) => d.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (activeDays.has(key)) {
      streak += 1;
    } else if (i > 0) {
      break;
    }
  }

  // Vocabulary due today
  const vocabDueToday = await prisma.spacedRepetitionItem.count({
    where: {
      userId: user.id,
      nextReviewAt: { lte: new Date() },
    },
  });

  // Questions this week vs last week
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [questionsThisWeek, questionsLastWeek] = await Promise.all([
    prisma.aIInteraction.count({
      where: { userId: user.id, createdAt: { gte: oneWeekAgo } },
    }),
    prisma.aIInteraction.count({
      where: {
        userId: user.id,
        createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo },
      },
    }),
  ]);

  const weekChange =
    questionsLastWeek > 0
      ? Math.round(((questionsThisWeek - questionsLastWeek) / questionsLastWeek) * 100)
      : null;

  return Response.json({
    dailyActivity,
    modeDistribution: modeDistribution.map((m) => ({ mode: m.mode, count: m._count })),
    topTopics,
    vocabularyLearned: vocabCount,
    vocabDueToday,
    totalQuestions: totalInteractions,
    streak,
    questionsThisWeek,
    questionsLastWeek,
    weekChange,
    period: "30 days",
  });
}
