/**
 * Data retention enforcement.
 *
 * Policies:
 * - AI interactions: 90 days
 * - AI evaluations: 90 days
 * - Safety logs (blocked): 180 days
 * - Audit trail: indefinite (compliance)
 * - Cached responses: managed by invalidation, not auto-deletion
 */

import { prisma } from "@/lib/prisma";

export async function enforceRetentionPolicies(): Promise<{
  interactionsDeleted: number;
  evaluationsDeleted: number;
  safetyLogsDeleted: number;
}> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  // Delete evaluations first (FK constraint to interactions)
  const evaluationsDeleted = await prisma.aIEvaluation.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });

  const interactionsDeleted = await prisma.aIInteraction.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });

  const safetyLogsDeleted = await prisma.aISafetyLog.deleteMany({
    where: { createdAt: { lt: oneEightyDaysAgo } },
  });

  console.log(
    `[Retention] Deleted: ${interactionsDeleted.count} interactions, ${evaluationsDeleted.count} evaluations, ${safetyLogsDeleted.count} safety logs`,
  );

  return {
    interactionsDeleted: interactionsDeleted.count,
    evaluationsDeleted: evaluationsDeleted.count,
    safetyLogsDeleted: safetyLogsDeleted.count,
  };
}

/**
 * Delete all AI data for a specific student (right to deletion).
 */
export async function deleteStudentAIData(studentId: string): Promise<{
  interactionsDeleted: number;
}> {
  const interactions = await prisma.aIInteraction.deleteMany({
    where: { userId: studentId },
  });

  console.log(`[Retention] Deleted ${interactions.count} interactions for student ${studentId}`);

  return { interactionsDeleted: interactions.count };
}
