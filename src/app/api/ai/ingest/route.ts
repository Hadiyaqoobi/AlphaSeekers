import { z } from "zod";

import { chunkDocument } from "@/lib/ai/chunker";
import { aiConfig } from "@/lib/ai/config";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { invalidateCache } from "@/lib/ai/response-cache";
import { ensureVectorExtension, replaceChunksForSource } from "@/lib/ai/vector-store";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";

const ingestSchema = z.object({
  sourceType: z.enum(["LIBRARY", "MATERIAL"]),
  sourceId: z.string().min(1),
  sourceTitle: z.string().min(1),
  content: z.string().min(10),
  classId: z.string().optional(), // Links document chunks to a specific class
});

function generateChunkId(sourceId: string, chunkIndex: number): string {
  return `chunk_${sourceId}_${chunkIndex}`;
}

/**
 * POST /api/ai/ingest
 *
 * Admin-only endpoint to ingest a document into the RAG vector store.
 * Chunks the text, generates embeddings, and stores in pgvector.
 *
 * Supports re-ingestion: existing chunks for the same source are
 * replaced (upserted) to keep content fresh.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Only admins can ingest documents");

  if (!aiConfig.enabled) {
    return Response.json(
      { message: "AI features are not configured. Set GROQ_API_KEY and HF_API_TOKEN." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = ingestSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest("Invalid input. Required: sourceType, sourceId, sourceTitle, content (min 10 chars).");
  }

  try {
    // Ensure pgvector extension exists
    await ensureVectorExtension();

    const { sourceType, sourceId, sourceTitle, content, classId } = parsed.data;

    // Chunk the document
    const chunks = chunkDocument({ content, sourceType, sourceId, sourceTitle });

    if (chunks.length === 0) {
      return Response.json({ message: "No chunks generated from content.", chunksCreated: 0 });
    }

    // ORDERING FIX: generate embeddings BEFORE touching existing data. If
    // embedding fails, the previously-ingested chunks are left untouched (the
    // source stays retrievable) instead of being deleted up-front.
    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    const chunksWithEmbeddings = chunks.map((chunk, i) => ({
      id: generateChunkId(sourceId, chunk.chunkIndex),
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      sourceTitle: chunk.sourceTitle,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[i],
      classId: classId || null,
    }));

    // Atomically swap old chunks for new ones (delete + insert in one
    // transaction) so re-ingestion never leaves the source empty on failure.
    const inserted = await replaceChunksForSource(sourceType, sourceId, chunksWithEmbeddings);

    // Materials changed → expire cached answers so stale responses don't
    // outlive the content they were derived from.
    await invalidateCache().catch(() => {});

    return Response.json({
      message: "Document ingested successfully.",
      sourceId,
      sourceTitle,
      chunksCreated: inserted,
      totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
    });
  } catch (error) {
    console.error("[AI] Ingestion failed:", error);
    return Response.json(
      {
        message: "Failed to ingest document.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
