/**
 * SM-2 (SuperMemo 2) spaced repetition algorithm.
 *
 * The same algorithm used by Anki — proven to improve retention ~200%
 * over massed practice.
 *
 * quality: 0 = complete failure, 3 = correct with difficulty, 5 = perfect
 */

import { prisma } from "@/lib/prisma";

function sm2(
  item: { easeFactor: number; interval: number; repetitions: number },
  quality: number,
): { easeFactor: number; interval: number; repetitions: number } {
  let { easeFactor, interval, repetitions } = item;

  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  return { easeFactor, interval, repetitions };
}

/**
 * Get items due for review for a student.
 */
export async function getDueItems(userId: string, limit = 5) {
  return prisma.spacedRepetitionItem.findMany({
    where: {
      userId,
      nextReviewAt: { lte: new Date() },
    },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
  });
}

/**
 * Record a review result and update the schedule.
 */
export async function recordReview(itemId: string, quality: number, userId: string) {
  const item = await prisma.spacedRepetitionItem.findUnique({ where: { id: itemId } });
  if (!item || item.userId !== userId) throw new Error("Item not found");

  const clamped = Math.max(0, Math.min(5, quality));
  const updated = sm2(
    { easeFactor: item.easeFactor, interval: item.interval, repetitions: item.repetitions },
    clamped,
  );

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + updated.interval);

  await prisma.spacedRepetitionItem.update({
    where: { id: itemId },
    data: {
      easeFactor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
      nextReviewAt,
      lastReviewedAt: new Date(),
    },
  });

  return { nextReviewAt, interval: updated.interval };
}

/**
 * Auto-extract vocabulary from AI responses and queue for spaced repetition.
 * Called after vocabulary/practice modes.
 */
export async function extractAndQueueVocabulary(params: {
  userId: string;
  aiResponse: string;
  classId?: string;
  mode: string;
}) {
  if (!["vocabulary", "practice"].includes(params.mode)) return;

  // Extract words from **bold** and "quoted" patterns
  const boldWords = Array.from(params.aiResponse.matchAll(/\*\*(.+?)\*\*/g)).map((m) => m[1]);
  const quotedWords = Array.from(params.aiResponse.matchAll(/"(.+?)"/g)).map((m) => m[1]);

  const candidates = Array.from(new Set([...boldWords, ...quotedWords]))
    .filter((w) => w.length > 2 && w.length < 50 && !/[.!?]/.test(w))
    .slice(0, 5);

  for (const term of candidates) {
    const existing = await prisma.spacedRepetitionItem.findFirst({
      where: { userId: params.userId, term },
    });

    if (!existing) {
      await prisma.spacedRepetitionItem.create({
        data: {
          userId: params.userId,
          term,
          definition: "",
          classId: params.classId || null,
          nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        },
      });
    }
  }
}
