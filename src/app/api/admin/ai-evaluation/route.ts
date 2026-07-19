/**
 * GET /api/admin/ai-evaluation?days=7
 *
 * Returns aggregated AI evaluation metrics for the admin dashboard.
 * Includes average scores, distribution, A/B test results, and alerts.
 */

import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/security/api-guard";

export async function GET(request: Request) {
  const g = await guardPermission("ai.manage");
  if (!g.ok) return g.response;

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [avgScores, abTestResults, lowQualityCount, safetyAlertCount, humanCalibration] =
    await Promise.all([
      prisma.aIEvaluation.aggregate({
        where: { createdAt: { gte: since } },
        _avg: {
          accuracy: true,
          pedagogy: true,
          safety: true,
          completeness: true,
          overall: true,
        },
        _count: true,
      }),

      prisma.aIEvaluation.groupBy({
        by: ["promptVariant"],
        where: {
          createdAt: { gte: since },
          promptVariant: { not: null },
        },
        _avg: {
          accuracy: true,
          pedagogy: true,
          safety: true,
          completeness: true,
          overall: true,
        },
        _count: true,
      }),

      prisma.aIEvaluation.count({
        where: { overall: { lt: 0.3 }, createdAt: { gte: since } },
      }),

      prisma.aISafetyLog.count({
        where: {
          safetyAction: { in: ["warn", "block"] },
          createdAt: { gte: since },
        },
      }),

      prisma.aIEvaluation.findMany({
        where: { humanReviewed: true, createdAt: { gte: since } },
        select: { overall: true, humanOverall: true },
      }),
    ]);

  // Evaluator-human agreement
  let calibrationScore: number | null = null;
  if (humanCalibration.length > 0) {
    calibrationScore =
      humanCalibration.reduce((sum, e) => {
        const diff = Math.abs((e.overall || 0) - (e.humanOverall || 0));
        return sum + (1 - diff);
      }, 0) / humanCalibration.length;
  }

  return Response.json({
    period: `${days} days`,
    totalEvaluated: avgScores._count,
    averageScores: avgScores._avg,
    abTestResults,
    alerts: { lowQuality: lowQualityCount, safety: safetyAlertCount },
    evaluatorCalibration: {
      humanReviewCount: humanCalibration.length,
      agreementRate: calibrationScore
        ? `${(calibrationScore * 100).toFixed(0)}%`
        : "No human reviews yet",
    },
  });
}
