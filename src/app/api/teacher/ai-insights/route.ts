/**
 * GET /api/teacher/ai-insights?classId=xxx
 *
 * Returns aggregated AI interaction data for a specific class.
 * Teachers can see what topics students are asking about,
 * what they struggle with, and how satisfied they are with AI answers.
 *
 * Access: teacher who owns the class, or admin.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");

  if (!classId) return badRequest("classId query parameter is required");

  // Verify teacher owns this class (or is admin)
  const classRecord = await prisma.class.findUnique({ where: { id: classId } });
  if (!classRecord) {
    return Response.json({ message: "Class not found" }, { status: 404 });
  }
  if (classRecord.teacherId !== user.id && user.role !== "ADMIN") {
    return forbidden("You can only view insights for your own classes");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get AI interactions that involved this class
  const interactions = await prisma.aIInteraction.findMany({
    where: {
      classIds: { contains: classId },
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      query: true,
      mode: true,
      rating: true,
      topics: true,
      createdAt: true,
    },
  });

  // Aggregate
  const totalQuestions = interactions.length;

  // Mode breakdown
  const modeBreakdown: Record<string, number> = {};
  for (const i of interactions) {
    modeBreakdown[i.mode] = (modeBreakdown[i.mode] || 0) + 1;
  }

  // Satisfaction
  const positiveRatings = interactions.filter((i) => i.rating === "positive").length;
  const negativeRatings = interactions.filter((i) => i.rating === "negative").length;
  const totalRated = positiveRatings + negativeRatings;

  // Topic analysis
  const allTopics = interactions.flatMap((i) =>
    (i.topics || "").split(",").filter(Boolean),
  );
  const topicCounts: Record<string, number> = {};
  for (const t of allTopics) {
    topicCounts[t] = (topicCounts[t] || 0) + 1;
  }
  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  // Struggled topics (negative feedback)
  const negativeTopics = interactions
    .filter((i) => i.rating === "negative")
    .flatMap((i) => (i.topics || "").split(",").filter(Boolean));
  const negTopicCounts: Record<string, number> = {};
  for (const t of negativeTopics) {
    negTopicCounts[t] = (negTopicCounts[t] || 0) + 1;
  }
  const struggledTopics = Object.entries(negTopicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Daily volume
  const dailyVolume: Record<string, number> = {};
  for (const i of interactions) {
    const day = i.createdAt.toISOString().split("T")[0];
    dailyVolume[day] = (dailyVolume[day] || 0) + 1;
  }

  return Response.json({
    className: classRecord.name,
    period: "7 days",
    totalQuestions,
    modeBreakdown,
    satisfaction: {
      positive: positiveRatings,
      negative: negativeRatings,
      rate: totalRated > 0 ? Math.round((positiveRatings / totalRated) * 100) : null,
    },
    topTopics,
    struggledTopics,
    dailyVolume,
  });
}
