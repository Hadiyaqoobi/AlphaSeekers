/**
 * RAG (Retrieval-Augmented Generation) pipeline.
 *
 * Orchestrates: query → context → embed → search → prompt → generate (stream)
 *
 * Architecture:
 *   1. Build student context (enrollment, schedule, history, detected mode)
 *   2. Embed the student's question using HuggingFace
 *   3. Search pgvector — enrolled class materials first, then global
 *   4. Build a personalized, mode-specific prompt with retrieved context
 *   5. Stream the LLM response via Groq (Llama 3.1) with Gemma fallback
 *   6. Log the interaction for learning history + teacher insights
 *   7. Return source citations alongside the answer
 */

import { prisma } from "@/lib/prisma";

import { assertAiConfigured } from "./config";
import { generateEmbedding } from "./embeddings";
import { assignVariant } from "./evaluation/ab-testing";
import { evaluateResponse } from "./evaluation/llm-judge";
import { generateCompletion, streamCompletionWithFallback } from "./llm";
import { stripPIIFromContext, scanPromptForPII } from "./privacy/pii-stripper";
import { buildIntelligentPrompt } from "./prompt-engine";
import { buildNoContextMessage, buildRagMessages } from "./prompts";
import { cacheResponse, checkCache, detectLanguage } from "./response-cache";
import { calculateConfidence } from "./safety/confidence";
import { classifyContent } from "./safety/content-classifier";
import { checkGuardrails } from "./safety/guardrails";
import { buildStudentContext, extractTopics, type AiMode } from "./student-context";
import {
  enrollmentAwareSearch,
  similaritySearch,
  type StoredChunk,
} from "./vector-store";

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
 * Streaming RAG query with intelligent tutoring.
 *
 * Builds student context, uses enrollment-aware retrieval,
 * and generates mode-specific personalized prompts.
 *
 * Event types:
 *   { type: "mode", mode: "study" }                          — detected AI mode
 *   { type: "sources", sources: [...], chunksUsed: N }       — metadata (sent first)
 *   { type: "text", content: "..." }                          — token delta
 *   { type: "done", latencyMs: N }                            — stream complete
 *   { type: "error", message: "..." }                         — error
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
            } catch {
              /* skip malformed sources */
            }
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

          // Log cache hit interaction (fire-and-forget)
          logInteraction({
            userId: request.userId,
            query: request.query,
            answer: cached.answer,
            provider: "cache",
            mode: "study",
            startTime: start,
          }).catch(() => {});
          return;
        }

        // 1. Build student context (parallel data fetch)
        const studentContext = await buildStudentContext(request.userId, request.query);

        // PRIVACY: Strip PII before prompt construction
        const { sanitizedContext } = stripPIIFromContext(studentContext);

        // Send detected mode to client
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "mode", mode: studentContext.detectedMode })}\n\n`,
          ),
        );

        // 2. Embed the query
        const queryEmbedding = await generateEmbedding(request.query);

        // 3. Enrollment-aware vector search
        const enrolledClassIds = studentContext.enrolledClasses.map((c) => c.classId);
        const chunks =
          enrolledClassIds.length > 0
            ? await enrollmentAwareSearch(queryEmbedding, enrolledClassIds)
            : await similaritySearch(queryEmbedding);

        // 4. SAFETY: Calculate confidence from retrieval quality
        const confidence = calculateConfidence(chunks, studentContext.detectedMode);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "confidence", level: confidence.level, label: confidence.label, labelDari: confidence.labelDari })}\n\n`,
          ),
        );

        // 5. Handle no results
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

        // 6. Send sources metadata
        const sources = deduplicateSources(chunks);
        const sourcesJson = JSON.stringify(sources);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "sources", sources, chunksUsed: chunks.length })}\n\n`,
          ),
        );

        // 7. A/B TESTING: Assign prompt variant
        const abResult = assignVariant(request.userId);

        // 8. Build intelligent, personalized prompt (with PII-stripped context)
        const promptChunks = chunks.map((c) => ({
          content: c.content,
          source: c.sourceTitle,
          classId: null as string | null,
        }));

        const confidenceWarning =
          confidence.level === "low"
            ? "WARNING: Very little relevant material was found. Be honest about your uncertainty. Suggest the student ask their teacher."
            : "";

        const messages = buildIntelligentPrompt(
          sanitizedContext,
          promptChunks,
          request.query,
          request.locale,
          {
            confidenceWarning,
            abTestAddition: abResult?.promptAddition,
          },
        );

        // PRIVACY: Final PII scan on assembled prompt
        const piiScan = scanPromptForPII(messages[0].content);
        if (!piiScan.clean) {
          console.warn("[Privacy] PII detected in prompt:", piiScan.findings);
        }

        // 9. Stream LLM response with fallback
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

            // === Background: cache + log + safety + evaluation (fire-and-forget) ===
            backgroundPostProcess({
              userId: request.userId,
              query: request.query,
              locale: request.locale,
              fullAnswer,
              sourcesJson,
              chunkContents: chunks.map((c) => c.content),
              provider: usedProvider,
              mode: studentContext.detectedMode,
              enrolledClassIds,
              confidence,
              abVariant: abResult?.variant || null,
              studentLevel: studentContext.estimatedLevel,
              startTime: start,
            }).catch((err) =>
              console.error("[AI] Background post-process failed:", (err as Error).message),
            );
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
 * Background post-processing: cache, log, safety check, evaluate.
 * Runs after the response is fully streamed to the student (Approach A).
 */
async function backgroundPostProcess(params: {
  userId: string;
  query: string;
  locale: string;
  fullAnswer: string;
  sourcesJson: string;
  chunkContents: string[];
  provider: string;
  mode: AiMode;
  enrolledClassIds: string[];
  confidence: { score: number; level: string };
  abVariant: string | null;
  studentLevel: string | null;
  startTime: number;
}): Promise<void> {
  // 1. Cache the response
  if (params.fullAnswer.length > 50) {
    cacheResponse({
      question: params.query,
      questionLang: detectLanguage(params.query),
      answer: params.fullAnswer,
      sources: params.sourcesJson,
      provider: params.provider,
    }).catch(() => {});
  }

  // 2. Log the interaction
  const interaction = await logInteraction({
    userId: params.userId,
    query: params.query,
    answer: params.fullAnswer,
    sources: params.sourcesJson,
    provider: params.provider,
    mode: params.mode,
    classIds: params.enrolledClassIds,
    startTime: params.startTime,
  });

  // 3. SAFETY: Post-generation checks
  const safetyResult = classifyContent(params.fullAnswer, params.query);
  const guardrailResult = checkGuardrails(
    params.fullAnswer,
    params.chunkContents,
    params.query,
  );

  // Log safety data
  try {
    await prisma.aISafetyLog.create({
      data: {
        interactionId: interaction?.id || null,
        confidenceScore: params.confidence.score,
        confidenceLevel: params.confidence.level,
        safetyPassed: safetyResult.safe && guardrailResult.passed,
        safetyCategory: safetyResult.category,
        safetyAction: safetyResult.action,
        guardrailViolations:
          guardrailResult.violations.length > 0
            ? JSON.stringify(guardrailResult.violations)
            : null,
        blockedResponse: !safetyResult.safe ? params.fullAnswer : null,
      },
    });
  } catch (err) {
    console.error("[Safety] Logging failed:", (err as Error).message);
  }

  if (!safetyResult.safe) {
    console.warn(`[Safety] BLOCKED response for user ${params.userId}: ${safetyResult.reason}`);
  }
  if (guardrailResult.violations.length > 0) {
    console.warn(
      `[Guardrails] Violations: ${guardrailResult.violations.map((v) => v.principle).join(", ")}`,
    );
  }

  // 4. EVALUATION: Score the response quality (non-blocking)
  if (interaction) {
    evaluateAndStore(interaction.id, {
      question: params.query,
      response: params.fullAnswer,
      sourceChunks: params.chunkContents,
      mode: params.mode,
      studentLevel: params.studentLevel,
      promptVariant: params.abVariant,
    }).catch((err) => console.error("[Eval] Background evaluation failed:", err));
  }
}

/**
 * Run LLM-as-judge evaluation and store the result.
 */
async function evaluateAndStore(
  interactionId: string,
  params: {
    question: string;
    response: string;
    sourceChunks: string[];
    mode: string;
    studentLevel: string | null;
    promptVariant: string | null;
  },
): Promise<void> {
  const result = await evaluateResponse(params);
  if (!result) return;

  await prisma.aIEvaluation.create({
    data: {
      interactionId,
      accuracy: result.accuracy,
      pedagogy: result.pedagogy,
      safety: result.safety,
      completeness: result.completeness,
      overall: result.overall,
      reasoning: result.reasoning,
      suggestions: result.suggestions,
      promptVariant: params.promptVariant,
    },
  });

  if (result.overall < 0.3) {
    console.warn(
      `[Eval] LOW QUALITY: interaction ${interactionId} scored ${result.overall.toFixed(2)}`,
    );
  }
  if (result.safety < 0.5) {
    console.warn(
      `[Eval] SAFETY ALERT: interaction ${interactionId} safety ${result.safety.toFixed(2)}`,
    );
  }
}

/**
 * Log an AI interaction. Returns the created record for downstream use.
 */
async function logInteraction(params: {
  userId: string;
  query: string;
  answer?: string;
  sources?: string;
  provider: string;
  mode: AiMode;
  classIds?: string[];
  startTime: number;
}): Promise<{ id: string } | null> {
  try {
    const topics = extractTopics([params.query]).join(",");
    return await prisma.aIInteraction.create({
      data: {
        userId: params.userId,
        query: params.query,
        answer: params.answer || null,
        sources: params.sources || null,
        mode: params.mode,
        topics: topics || null,
        provider: params.provider,
        classIds: params.classIds?.join(",") || null,
        responseMs: Date.now() - params.startTime,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[AI] Interaction logging failed:", (err as Error).message);
    return null;
  }
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
