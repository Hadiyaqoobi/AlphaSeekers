/**
 * RAG (Retrieval-Augmented Generation) pipeline.
 *
 * Orchestrates: query → embed → search → prompt → generate (stream)
 *
 * Architecture:
 *   1. Embed the student's question using HuggingFace
 *   2. Search pgvector for similar document chunks
 *   3. Build a grounded prompt with retrieved context
 *   4. Stream the LLM response via Groq (Llama 3.1)
 *   5. Return source citations alongside the answer
 */

import { assertAiConfigured } from "./config";
import { generateEmbedding } from "./embeddings";
import { generateCompletion, streamCompletionWithFallback } from "./llm";
import { buildNoContextMessage, buildRagMessages } from "./prompts";
import { cacheResponse, checkCache, detectLanguage } from "./response-cache";
import { similaritySearch, type StoredChunk } from "./vector-store";

export type RagRequest = {
  query: string;
  locale: string;
  userId: string;
};

export type RagSource = {
  title: string;
  sourceId: string;
  sourceType: string;
  relevance: number;
};

export type RagResult = {
  answer: string;
  sources: RagSource[];
  chunksUsed: number;
  latencyMs: number;
};

/**
 * Non-streaming RAG query. Returns the full answer once generation completes.
 */
export async function ragQuery(request: RagRequest): Promise<RagResult> {
  assertAiConfigured();

  const start = Date.now();

  // 1. Embed the query
  const queryEmbedding = await generateEmbedding(request.query);

  // 2. Search for relevant chunks
  const chunks = await similaritySearch(queryEmbedding);

  // 3. Handle no results
  if (chunks.length === 0) {
    return {
      answer: buildNoContextMessage(request.locale),
      sources: [],
      chunksUsed: 0,
      latencyMs: Date.now() - start,
    };
  }

  // 4. Build RAG prompt
  const messages = buildRagMessages({
    query: request.query,
    locale: request.locale,
    chunks: chunks.map((c) => ({
      content: c.content,
      sourceTitle: c.sourceTitle,
      similarity: c.similarity,
    })),
  });

  // 5. Generate answer
  const answer = await generateCompletion(messages);

  // 6. Extract unique sources
  const sources = deduplicateSources(chunks);

  return {
    answer,
    sources,
    chunksUsed: chunks.length,
    latencyMs: Date.now() - start,
  };
}

/**
 * Streaming RAG query. Returns a ReadableStream of SSE events.
 *
 * Event types:
 *   { type: "sources", sources: [...], chunksUsed: N }  — metadata (sent first)
 *   { type: "text", content: "..." }                     — token delta
 *   { type: "done", latencyMs: N }                       — stream complete
 *   { type: "error", message: "..." }                    — error
 */
export function createRagStream(request: RagRequest): ReadableStream {
  assertAiConfigured();

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const start = Date.now();

      try {
        // 0. Check cache BEFORE any expensive work
        const cached = await checkCache(request.query);
        if (cached) {
          if (cached.sources) {
            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "sources", sources: JSON.parse(cached.sources), chunksUsed: 0 })}\n\n`,
                ),
              );
            } catch { /* skip malformed sources */ }
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text", content: cached.answer })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", latencyMs: Date.now() - start, cached: true })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        // 1. Embed the query
        const queryEmbedding = await generateEmbedding(request.query);

        // 2. Search for relevant chunks
        const chunks = await similaritySearch(queryEmbedding);

        // 3. Handle no results
        if (chunks.length === 0) {
          const noContextMsg = buildNoContextMessage(request.locale);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text", content: noContextMsg })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", sources: [], chunksUsed: 0, latencyMs: Date.now() - start })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        // 4. Send sources metadata first
        const sources = deduplicateSources(chunks);
        const sourcesJson = JSON.stringify(sources);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "sources", sources, chunksUsed: chunks.length })}\n\n`,
          ),
        );

        // 5. Build RAG prompt and stream LLM response
        const messages = buildRagMessages({
          query: request.query,
          locale: request.locale,
          chunks: chunks.map((c) => ({
            content: c.content,
            sourceTitle: c.sourceTitle,
            similarity: c.similarity,
          })),
        });

        let fullAnswer = "";
        let usedProvider = "groq";

        await streamCompletionWithFallback(messages, {
          onToken(token) {
            fullAnswer += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", content: token })}\n\n`),
            );
          },
          onDone() {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "done", latencyMs: Date.now() - start })}\n\n`,
              ),
            );
            controller.close();

            // Cache the response in background (fire-and-forget)
            if (fullAnswer.length > 50) {
              cacheResponse({
                question: request.query,
                questionLang: detectLanguage(request.query),
                answer: fullAnswer,
                sources: sourcesJson,
                provider: usedProvider,
              }).catch(() => {});
            }
          },
          onProvider(name) {
            usedProvider = name;
          },
          onError(error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
              ),
            );
            controller.close();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "RAG pipeline failed";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`),
        );
        controller.close();
      }
    },
  });
}

/**
 * Deduplicate sources by sourceId, keeping the highest relevance score.
 */
function deduplicateSources(chunks: StoredChunk[]): RagSource[] {
  const seen = new Map<string, RagSource>();

  for (const chunk of chunks) {
    const existing = seen.get(chunk.sourceId);
    if (!existing || chunk.similarity > existing.relevance) {
      seen.set(chunk.sourceId, {
        title: chunk.sourceTitle,
        sourceId: chunk.sourceId,
        sourceType: chunk.sourceType,
        relevance: chunk.similarity,
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.relevance - a.relevance);
}
