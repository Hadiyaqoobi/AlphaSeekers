/**
 * AI response cache.
 *
 * Caches LLM answers so common questions get instant responses.
 * Uses SHA-256 hash of normalized question text for exact matching.
 * Self-healing: low-quality entries are removed based on student feedback.
 */

import crypto from "crypto";

import { prisma } from "@/lib/prisma";

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[؟?!.،,]/g, "")
    .replace(/\s+/g, " ");
}

function hashQuestion(text: string): string {
  return crypto.createHash("sha256").update(normalizeQuestion(text)).digest("hex");
}

/**
 * Check cache for an exact match.
 */
export async function checkCache(
  question: string,
): Promise<{ answer: string; sources: string | null } | null> {
  try {
    const hash = hashQuestion(question);
    const match = await prisma.cachedResponse.findFirst({
      where: {
        questionHash: hash,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!match) {
      console.log(`[Cache] Miss: "${question.substring(0, 50)}..."`);
      return null;
    }

    // Increment hit count (fire-and-forget)
    prisma.cachedResponse
      .update({ where: { id: match.id }, data: { hitCount: { increment: 1 } } })
      .catch(() => {});

    console.log(`[Cache] Hit: "${question.substring(0, 50)}..."`);
    return { answer: match.answer, sources: match.sources };
  } catch {
    return null;
  }
}

/**
 * Store a response in cache.
 */
export async function cacheResponse(params: {
  question: string;
  questionLang: string;
  answer: string;
  sources?: string;
  provider: string;
}): Promise<void> {
  try {
    const hash = hashQuestion(params.question);

    await prisma.cachedResponse.upsert({
      where: { questionHash: hash },
      update: {
        answer: params.answer,
        sources: params.sources || null,
        provider: params.provider,
        updatedAt: new Date(),
      },
      create: {
        questionHash: hash,
        questionText: params.question,
        questionLang: params.questionLang,
        answer: params.answer,
        sources: params.sources || null,
        provider: params.provider,
      },
    });

    console.log(`[Cache] Stored: "${params.question.substring(0, 50)}..."`);
  } catch (err) {
    console.error("[Cache] Store failed:", (err as Error).message);
  }
}

/**
 * Invalidate all cache entries (e.g. when course materials change).
 */
export async function invalidateCache(): Promise<number> {
  try {
    const result = await prisma.cachedResponse.updateMany({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      data: { expiresAt: new Date() },
    });
    console.log(`[Cache] Invalidated ${result.count} entries`);
    return result.count;
  } catch {
    return 0;
  }
}

/**
 * Update cache quality based on user feedback.
 * Removes entries that drop below quality threshold.
 */
export async function updateCacheQuality(
  question: string,
  rating: "up" | "down",
): Promise<void> {
  try {
    const hash = hashQuestion(question);
    const cached = await prisma.cachedResponse.findUnique({
      where: { questionHash: hash },
    });
    if (!cached) return;

    const newRating = rating === "up" ? 1.0 : 0.0;
    const currentQuality = cached.quality ?? 0.5;
    const totalRatings = Math.max(cached.hitCount, 1);
    const updatedQuality =
      (currentQuality * (totalRatings - 1) + newRating) / totalRatings;

    if (updatedQuality < 0.3 && totalRatings >= 3) {
      await prisma.cachedResponse.delete({ where: { id: cached.id } });
      console.log(`[Cache] Removed low-quality: "${question.substring(0, 50)}..."`);
      return;
    }

    await prisma.cachedResponse.update({
      where: { id: cached.id },
      data: { quality: updatedQuality },
    });
  } catch {
    // Non-critical
  }
}

/**
 * Detect if text is Dari or English.
 */
export function detectLanguage(text: string): string {
  const dariChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = text.replace(/\s/g, "").length;
  return totalChars > 0 && dariChars / totalChars > 0.3 ? "fa" : "en";
}
