/**
 * AI response cache.
 *
 * Caches LLM answers so common questions get instant responses.
 *
 * PRIVACY (CRITICAL): answers produced by the RAG pipeline are PERSONALIZED —
 * they depend on the asking student's identity, level, and (above all) the
 * retrieval scope of the classes they are enrolled in. Keying the cache by the
 * question text alone leaks one student's answer to every other student and can
 * surface course material from classes the reader is not enrolled in.
 *
 * To make cross-user leakage impossible, the cache key is now
 *   hash( userId + sorted(classScope) + normalizedQuestion )
 * and a cache entry is ONLY read/written when an explicit CacheScope is
 * supplied. Callers that cannot prove a request is non-personalized (i.e. that
 * omit the scope) get a guaranteed cache MISS on read and a no-op on write —
 * fail-safe, never a shared answer.
 *
 * Entries also carry a TTL so a stale answer never outlives its source
 * material; re-ingestion additionally calls invalidateCache().
 */

import crypto from "crypto";

import { prisma } from "@/lib/prisma";

import { aiConfig } from "./config";

/**
 * Identity + retrieval scope that a cached answer is valid for. An entry keyed
 * with a given scope is ONLY ever served back for that exact same scope, so a
 * different user (or the same user with a different class scope) can never read
 * it.
 */
export type CacheScope = {
  /** The asking user's id — isolates every student's cache from every other. */
  userId: string;
  /** Class/material scope the answer was retrieved from (e.g. enrolled class ids). */
  classScope?: string[] | null;
};

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[؟?!.،,]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Derive a stable, order-independent key fragment from a scope. Returns null
 * when the scope is missing/invalid, which the callers treat as "do not use the
 * shared cache" (fail-safe).
 */
function scopeKey(scope?: CacheScope | null): string | null {
  if (!scope || !scope.userId) return null;
  const classes = (scope.classScope ?? [])
    .filter((c): c is string => typeof c === "string" && c.length > 0)
    .slice()
    .sort()
    .join(",");
  return `u:${scope.userId}|c:${classes}`;
}

function hashQuestion(text: string, scope?: CacheScope | null): string | null {
  const sk = scopeKey(scope);
  if (sk === null) return null;
  return crypto
    .createHash("sha256")
    .update(`${sk}::${normalizeQuestion(text)}`)
    .digest("hex");
}

/**
 * Check cache for an exact match WITHIN the caller's scope.
 *
 * Returns null (a guaranteed miss) when no scope is supplied — this is what
 * prevents a personalized answer from ever crossing to another user.
 */
export async function checkCache(
  question: string,
  scope?: CacheScope | null,
): Promise<{ answer: string; sources: string | null } | null> {
  const hash = hashQuestion(question, scope);
  if (hash === null) {
    // No scope → cannot prove this is safe to share. Fail-safe miss.
    return null;
  }

  try {
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
 * Store a response in cache, scoped to the asking user + retrieval scope.
 *
 * A no-op when no scope is supplied (we refuse to store an answer we could not
 * later serve safely).
 */
export async function cacheResponse(params: {
  question: string;
  questionLang: string;
  answer: string;
  sources?: string;
  provider: string;
  scope?: CacheScope | null;
}): Promise<void> {
  const hash = hashQuestion(params.question, params.scope);
  if (hash === null) {
    // No scope → do not persist a personalized answer under a shareable key.
    return;
  }

  try {
    const expiresAt = new Date(Date.now() + aiConfig.cache.ttlMs);

    await prisma.cachedResponse.upsert({
      where: { questionHash: hash },
      update: {
        answer: params.answer,
        sources: params.sources || null,
        provider: params.provider,
        updatedAt: new Date(),
        expiresAt,
      },
      create: {
        questionHash: hash,
        questionText: params.question,
        questionLang: params.questionLang,
        answer: params.answer,
        sources: params.sources || null,
        provider: params.provider,
        expiresAt,
      },
    });

    console.log(`[Cache] Stored: "${params.question.substring(0, 50)}..."`);
  } catch (err) {
    console.error("[Cache] Store failed:", (err as Error).message);
  }
}

/**
 * Invalidate all cache entries (e.g. when course materials change / on
 * re-ingestion). Marks live entries as expired.
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
 *
 * `scope` must match the scope the answer was cached under; without it the
 * lookup simply finds nothing (fail-safe, non-critical self-healing signal).
 */
export async function updateCacheQuality(
  question: string,
  rating: "up" | "down",
  scope?: CacheScope | null,
): Promise<void> {
  const hash = hashQuestion(question, scope);
  if (hash === null) return;

  try {
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
  const dariChars = (text.match(/[؀-ۿ]/g) || []).length;
  const totalChars = text.replace(/\s/g, "").length;
  return totalChars > 0 && dariChars / totalChars > 0.3 ? "fa" : "en";
}
