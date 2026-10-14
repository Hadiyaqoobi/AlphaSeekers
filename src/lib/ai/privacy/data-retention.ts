/**
 * Data retention enforcement.
 *
 * Policies:
 * - AI interactions: 90 days
 * - AI evaluations: 90 days
 * - AI conversation memory: 90 days since last update
 * - Safety logs (blocked): 180 days
 * - Cached responses: once past expiresAt (rows with no expiry are managed by
 *   invalidation, not auto-deletion)
 * - Notifications (in-app feed + delivery records): 90 days
 * - Password-reset tokens: 7 days after they expired
 * - Rate-limit buckets: 1 day after their window reset
 * - Scheduler runs: 30 days after they finished (COMPLETED/FAILED)
 * - Audit trail: indefinite (compliance)
 *
 * Several of these tables previously had nothing deleting from them at all, so
 * they only ever grew — RateLimitBucket gains a row per IP per limiter.
 */

import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function enforceRetentionPolicies(): Promise<{
  interactionsDeleted: number;
  evaluationsDeleted: number;
  safetyLogsDeleted: number;
  conversationsDeleted: number;
  cachedResponsesDeleted: number;
  notificationsDeleted: number;
  passwordResetsDeleted: number;
  rateLimitBucketsDeleted: number;
  schedulerJobsDeleted: number;
}> {
  const now = Date.now();
  const ninetyDaysAgo = new Date(now - 90 * DAY_MS);
  const oneEightyDaysAgo = new Date(now - 180 * DAY_MS);

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

  // By last activity, not creation: a conversation still in use is kept.
  const conversationsDeleted = await prisma.aIConversation.deleteMany({
    where: { updatedAt: { lt: ninetyDaysAgo } },
  });

  const cachedResponsesDeleted = await prisma.cachedResponse.deleteMany({
    where: { expiresAt: { lt: new Date(now) } },
  });

  const notificationsDeleted = await prisma.notification.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });

  const passwordResetsDeleted = await prisma.passwordReset.deleteMany({
    where: { expiresAt: { lt: new Date(now - 7 * DAY_MS) } },
  });

  const rateLimitBucketsDeleted = await prisma.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: new Date(now - DAY_MS) } },
  });

  // Only finished runs; a PENDING/RUNNING claim is live scheduler state.
  const schedulerJobsDeleted = await prisma.schedulerJob.deleteMany({
    where: { status: { in: ["COMPLETED", "FAILED"] }, updatedAt: { lt: new Date(now - 30 * DAY_MS) } },
  });

  console.log(
    `[Retention] Deleted: ${interactionsDeleted.count} interactions, ${evaluationsDeleted.count} evaluations, ${safetyLogsDeleted.count} safety logs, ` +
      `${conversationsDeleted.count} conversations, ${cachedResponsesDeleted.count} expired cached responses, ${notificationsDeleted.count} notifications, ` +
      `${passwordResetsDeleted.count} password resets, ${rateLimitBucketsDeleted.count} rate-limit buckets, ${schedulerJobsDeleted.count} scheduler runs`,
  );

  return {
    interactionsDeleted: interactionsDeleted.count,
    evaluationsDeleted: evaluationsDeleted.count,
    safetyLogsDeleted: safetyLogsDeleted.count,
    conversationsDeleted: conversationsDeleted.count,
    cachedResponsesDeleted: cachedResponsesDeleted.count,
    notificationsDeleted: notificationsDeleted.count,
    passwordResetsDeleted: passwordResetsDeleted.count,
    rateLimitBucketsDeleted: rateLimitBucketsDeleted.count,
    schedulerJobsDeleted: schedulerJobsDeleted.count,
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

/**
 * Best-effort deletion / anonymization of ALL of a user's AI-generated data.
 *
 * Called by the account-deletion endpoint (right to erasure). Each step is
 * isolated so a single failure never blocks the rest of the wipe. Covers:
 *   - AI safety logs tied to the user's interactions (no FK cascade)
 *   - AI interactions (cascades AIEvaluation via FK)
 *   - AI conversation memory
 *   - AI-generated spaced-repetition / vocabulary items
 *   - AI-generated learning paths (cascades LessonProgress via FK)
 *
 * NOTE: DocumentChunk rows are shared COURSE MATERIAL, not the user's personal
 * data, so they are intentionally NOT deleted here. Cached answers are keyed by
 * a hash that embeds the user id (see response-cache.ts) and are not queryable
 * by user id under the current schema; they carry a TTL and can never be served
 * to another user, so they expire on their own. See needs_ops_action for adding
 * a userId column to CachedResponse if hard per-user purge is later required.
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  // 1. Safety logs reference interactionId as a plain column (no FK cascade),
  //    so collect the user's interaction ids and delete their logs first.
  try {
    const interactions = await prisma.aIInteraction.findMany({
      where: { userId },
      select: { id: true },
    });
    const interactionIds = interactions.map((i) => i.id);
    if (interactionIds.length > 0) {
      await prisma.aISafetyLog.deleteMany({
        where: { interactionId: { in: interactionIds } },
      });
    }
  } catch (err) {
    console.error("[Retention] Failed to delete safety logs for user:", (err as Error).message);
  }

  // 2. Interactions (AIEvaluation cascades via its FK to AIInteraction).
  try {
    const res = await prisma.aIInteraction.deleteMany({ where: { userId } });
    console.log(`[Retention] Deleted ${res.count} interactions for user ${userId}`);
  } catch (err) {
    console.error("[Retention] Failed to delete interactions for user:", (err as Error).message);
  }

  // 3. Conversation memory.
  try {
    await prisma.aIConversation.deleteMany({ where: { userId } });
  } catch (err) {
    console.error("[Retention] Failed to delete conversations for user:", (err as Error).message);
  }

  // 4. AI-generated spaced-repetition / vocabulary items.
  try {
    await prisma.spacedRepetitionItem.deleteMany({ where: { userId } });
  } catch (err) {
    console.error("[Retention] Failed to delete SRS items for user:", (err as Error).message);
  }

  // 5. AI-generated learning paths (LessonProgress cascades via FK to path).
  try {
    await prisma.learningPath.deleteMany({ where: { userId } });
  } catch (err) {
    console.error("[Retention] Failed to delete learning paths for user:", (err as Error).message);
  }
}
