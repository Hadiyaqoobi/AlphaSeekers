/**
 * Vector store operations using pgvector on PostgreSQL/Neon.
 *
 * Uses Prisma $queryRawUnsafe/$executeRawUnsafe for vector operations
 * since Prisma does not natively support the vector type.
 *
 * Requires: CREATE EXTENSION vector; (supported on Neon free tier)
 */

import { prisma } from "@/lib/prisma";
import { aiConfig } from "./config";

export type StoredChunk = {
  id: string;
  content: string;
  sourceTitle: string;
  sourceId: string;
  sourceType: string;
  chunkIndex: number;
  similarity: number;
};

/**
 * Ensure the pgvector extension is installed.
 * Safe to call multiple times (uses IF NOT EXISTS).
 */
export async function ensureVectorExtension(): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
    return true;
  } catch (error) {
    console.error("[AI] Failed to create vector extension:", error);
    return false;
  }
}

/**
 * Check if the DocumentChunk table exists and has data.
 */
export async function isVectorStoreReady(): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe<[{ exists: boolean }]>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'DocumentChunk'
      )`,
    );
    return result[0]?.exists === true;
  } catch {
    return false;
  }
}

/**
 * Insert document chunks with their embedding vectors.
 * Uses ON CONFLICT for idempotent re-ingestion.
 */
export async function insertChunks(
  chunks: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    sourceTitle: string;
    content: string;
    chunkIndex: number;
    tokenCount: number;
    embedding: number[];
    classId?: string | null;
  }>,
): Promise<number> {
  let inserted = 0;

  for (const chunk of chunks) {
    const embeddingStr = `[${chunk.embedding.join(",")}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentChunk" (id, "sourceType", "sourceId", "sourceTitle", content, "chunkIndex", "tokenCount", "classId", embedding, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, NOW())
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         "sourceTitle" = EXCLUDED."sourceTitle",
         "tokenCount" = EXCLUDED."tokenCount",
         "classId" = EXCLUDED."classId",
         embedding = EXCLUDED.embedding`,
      chunk.id,
      chunk.sourceType,
      chunk.sourceId,
      chunk.sourceTitle,
      chunk.content,
      chunk.chunkIndex,
      chunk.tokenCount,
      chunk.classId ?? null,
      embeddingStr,
    );
    inserted += 1;
  }

  return inserted;
}

/**
 * Cosine similarity search against the vector store.
 * Returns the top-K most similar chunks above the similarity threshold.
 */
export async function similaritySearch(
  queryEmbedding: number[],
  topK?: number,
  threshold?: number,
): Promise<StoredChunk[]> {
  const k = topK ?? aiConfig.rag.topK;
  const minSimilarity = threshold ?? aiConfig.rag.similarityThreshold;
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const results = await prisma.$queryRawUnsafe<StoredChunk[]>(
    `SELECT id, content, "sourceTitle", "sourceId", "sourceType", "chunkIndex",
            1 - (embedding <=> $1::vector) as similarity
     FROM "DocumentChunk"
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    embeddingStr,
    k,
  );

  // Filter by minimum similarity threshold
  return results.filter((r) => r.similarity >= minSimilarity);
}

/**
 * Two-stage enrollment-aware similarity search.
 *
 * Stage 1: Search within the student's enrolled class materials (higher relevance).
 * Stage 2: If not enough results, fill from the general pool.
 *
 * This means a student enrolled in "English A2" who asks about grammar
 * gets answers from their English A2 textbook, not from Korean class materials.
 */
export async function enrollmentAwareSearch(
  queryEmbedding: number[],
  enrolledClassIds: string[],
  topK?: number,
  threshold?: number,
): Promise<StoredChunk[]> {
  const k = topK ?? aiConfig.rag.topK;
  const minSimilarity = threshold ?? aiConfig.rag.similarityThreshold;
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  let results: StoredChunk[] = [];

  // Stage 1: Search within enrolled classes
  if (enrolledClassIds.length > 0) {
    const placeholders = enrolledClassIds.map((_, i) => `$${i + 2}`).join(", ");
    const enrolledResults = await prisma.$queryRawUnsafe<StoredChunk[]>(
      `SELECT id, content, "sourceTitle", "sourceId", "sourceType", "chunkIndex",
              1 - (embedding <=> $1::vector) as similarity
       FROM "DocumentChunk"
       WHERE "classId" IN (${placeholders})
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT ${k}`,
      embeddingStr,
      ...enrolledClassIds,
    );

    results = enrolledResults.filter((r) => r.similarity >= minSimilarity);
  }

  // Stage 2: Fill remaining slots from global pool
  if (results.length < k) {
    const remaining = k - results.length;
    const existingIds = new Set(results.map((r) => r.id));

    const globalResults = await prisma.$queryRawUnsafe<StoredChunk[]>(
      `SELECT id, content, "sourceTitle", "sourceId", "sourceType", "chunkIndex",
              1 - (embedding <=> $1::vector) as similarity
       FROM "DocumentChunk"
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      embeddingStr,
      remaining + results.length, // fetch extra to account for overlap
    );

    for (const r of globalResults) {
      if (results.length >= k) break;
      if (!existingIds.has(r.id) && r.similarity >= minSimilarity) {
        results.push(r);
      }
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Delete all chunks for a given source (used for re-ingestion).
 */
export async function deleteChunksBySource(sourceType: string, sourceId: string): Promise<number> {
  return prisma.$executeRawUnsafe(
    `DELETE FROM "DocumentChunk" WHERE "sourceType" = $1 AND "sourceId" = $2`,
    sourceType,
    sourceId,
  );
}

/**
 * Get aggregate statistics about the vector store.
 */
export async function getChunkStats(): Promise<{
  totalChunks: number;
  totalSources: number;
  byType: Array<{ sourceType: string; count: number }>;
}> {
  const total = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "DocumentChunk"`,
  );

  const sources = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(DISTINCT "sourceId") as count FROM "DocumentChunk"`,
  );

  const byType = await prisma.$queryRawUnsafe<Array<{ sourceType: string; count: bigint }>>(
    `SELECT "sourceType", COUNT(*) as count FROM "DocumentChunk" GROUP BY "sourceType"`,
  );

  return {
    totalChunks: Number(total[0]?.count ?? 0),
    totalSources: Number(sources[0]?.count ?? 0),
    byType: byType.map((row) => ({
      sourceType: row.sourceType,
      count: Number(row.count),
    })),
  };
}
