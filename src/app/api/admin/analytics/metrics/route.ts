/**
 * GET /api/admin/analytics/metrics
 *
 * Real platform metrics for the analytics dashboard.
 * Available to all ADMINs (this is for the team — not superadmin-restricted).
 *
 * Returns growth, engagement, AI performance, content, and retention KPIs
 * plus daily time-series data for charts.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";

type DailyRow = { date: string; count: bigint };

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Admin access required");

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel
  const [
    totalUsers,
    usersByRole,
    newUsersThisWeek,
    newUsersThisMonth,
    approvedUsers,
    totalEnrollments,
    activeEnrollments,
    totalSessions,
    sessionsThisWeek,
    totalClasses,
    activeClasses,
    totalAIQuestions,
    aiQuestionsThisWeek,
    aiModeDistribution,
    aiPositiveRatings,
    aiTotalRatings,
    aiAvgResponseTime,
    cachedResponses,
    totalCacheHits,
    totalMaterials,
    totalChunksRaw,
    totalOpportunities,
    activeStudentsLast7Days,
    inactiveStudents14Days,
    dailyRegistrationsRaw,
    dailyAIQuestionsRaw,
    topTopicsRaw,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { approvedAt: { not: null } } }),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    prisma.session.count({ where: { cancelled: false } }),
    prisma.session.count({ where: { startTime: { gte: sevenDaysAgo }, cancelled: false } }),
    prisma.class.count(),
    prisma.class.count({ where: { status: "ACTIVE" } }),
    prisma.aIInteraction.count(),
    prisma.aIInteraction.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.aIInteraction.groupBy({ by: ["mode"], _count: true }),
    prisma.aIInteraction.count({ where: { rating: "positive" } }),
    prisma.aIInteraction.count({ where: { rating: { not: null } } }),
    prisma.aIInteraction.aggregate({ _avg: { responseMs: true } }),
    prisma.cachedResponse.count(),
    prisma.cachedResponse.aggregate({ _sum: { hitCount: true } }),
    prisma.material.count(),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint as count FROM "DocumentChunk"`,
    ),
    prisma.opportunity.count(),
    prisma.aIInteraction
      .findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ["userId"],
      })
      .then((r) => r.length),
    prisma.user.count({
      where: {
        role: "STUDENT",
        approvedAt: { not: null },
        updatedAt: { lt: fourteenDaysAgo },
      },
    }),
    prisma.$queryRawUnsafe<DailyRow[]>(
      `SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') as date, COUNT(*)::bigint as count
       FROM "User"
       WHERE "createdAt" >= $1
       GROUP BY DATE("createdAt")
       ORDER BY date ASC`,
      thirtyDaysAgo,
    ),
    prisma.$queryRawUnsafe<DailyRow[]>(
      `SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') as date, COUNT(*)::bigint as count
       FROM "AIInteraction"
       WHERE "createdAt" >= $1
       GROUP BY DATE("createdAt")
       ORDER BY date ASC`,
      thirtyDaysAgo,
    ),
    prisma.aIInteraction.findMany({
      where: { topics: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { topics: true },
      take: 1000,
    }),
  ]);

  // Derive role counts
  const totalStudents = usersByRole.find((r) => r.role === "STUDENT")?._count ?? 0;
  const totalTeachers = usersByRole.find((r) => r.role === "TEACHER")?._count ?? 0;
  const totalAdmins = usersByRole.find((r) => r.role === "ADMIN")?._count ?? 0;

  const approvalRate = totalUsers > 0 ? Math.round((approvedUsers / totalUsers) * 100) : 0;
  const aiSatisfactionRate =
    aiTotalRatings > 0 ? Math.round((aiPositiveRatings / aiTotalRatings) * 100) : null;
  const avgResponseMs = aiAvgResponseTime._avg?.responseMs
    ? Math.round(aiAvgResponseTime._avg.responseMs)
    : null;
  const cacheHitTotal = totalCacheHits._sum?.hitCount ?? 0;
  const totalChunks = Number(totalChunksRaw[0]?.count ?? 0);
  const avgClassesPerStudent =
    totalStudents > 0 ? (activeEnrollments / totalStudents).toFixed(1) : "0";

  // Build top topics
  const allTopics = topTopicsRaw.flatMap((r) => (r.topics || "").split(",").filter(Boolean));
  const topicCounts: Record<string, number> = {};
  for (const t of allTopics) {
    topicCounts[t] = (topicCounts[t] || 0) + 1;
  }
  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  return Response.json({
    summary: {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalClasses,
      activeClasses,
      totalEnrollments,
      activeEnrollments,
      totalSessions,
      totalAIQuestions,
      totalMaterials,
      totalOpportunities,
    },
    growth: {
      newUsersThisWeek,
      newUsersThisMonth,
      approvalRate,
      registrationTrend: dailyRegistrationsRaw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
    },
    engagement: {
      sessionsThisWeek,
      avgClassesPerStudent,
      activeStudentsLast7Days,
      inactiveStudents14Days,
    },
    ai: {
      totalQuestions: totalAIQuestions,
      questionsThisWeek: aiQuestionsThisWeek,
      satisfactionRate: aiSatisfactionRate,
      avgResponseMs,
      modeDistribution: aiModeDistribution.map((m) => ({
        mode: m.mode,
        count: m._count,
        percentage: totalAIQuestions > 0 ? Math.round((m._count / totalAIQuestions) * 100) : 0,
      })),
      cacheStats: { totalCached: cachedResponses, totalHits: cacheHitTotal },
      questionsTrend: dailyAIQuestionsRaw.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      topTopics,
    },
    content: { totalMaterials, totalChunks, totalOpportunities },
    generatedAt: now.toISOString(),
  });
}
