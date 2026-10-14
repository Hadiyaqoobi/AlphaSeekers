/**
 * RAG (Retrieval-Augmented Generation) pipeline.
 *
 * Orchestrates: screen → context → cache → embed → search → prompt → generate (stream)
 *
 * Architecture:
 *   0. Pre-screen the QUESTION (harmful request → refuse; distress → careful
 *      short reply). This is the only safety step that runs before the student
 *      sees anything; the post-generation checks can only log.
 *   1. Build student context (enrollment, schedule, history, detected mode)
 *   2. Per-user cache lookup (scoped to the user + their enrolled classes)
 *   3. Embed the student's question (emails/phone numbers redacted first)
 *   4. Search pgvector — enrolled class materials first, then general material
 *   5. Build a personalized, mode-specific prompt with retrieved context
 *   6. Stream the LLM response via Groq (Llama 3.1) with Gemma fallback
 *   7. Log the interaction, tagged ONLY with the classes whose material was
 *      used to answer (not every class the student is in)
 */

import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

import { assertAiConfigured } from "./config";
import { generateEmbedding } from "./embeddings";
import { assignVariant } from "./evaluation/ab-testing";
import { evaluateResponse, shouldEvaluate } from "./evaluation/llm-judge";
import { generateCompletion, streamCompletionWithFallback, type ChatMessage } from "./llm";
import { redactPII, stripPIIFromContext, scanPromptForPII } from "./privacy/pii-stripper";
import { buildIntelligentPrompt } from "./prompt-engine";
import {
  buildGeneralKnowledgeDisclaimer,
  buildGeneralKnowledgeMessages,
  buildNoContextMessage,
  buildRagMessages,
} from "./prompts";
import { cacheResponse, checkCache, detectLanguage, type CacheScope } from "./response-cache";
import { calculateConfidence } from "./safety/confidence";
import {
  DISTRESS_PROMPT_ADDITION,
  classifyContent,
  getSafeResponse,
  prescreenQuery,
  type PrescreenResult,
} from "./safety/content-classifier";
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

/** Shown to the student when the pipeline fails; never the raw error text. */
const STREAM_FAILURE_MESSAGE = "The study assistant could not answer right now. Please try again.";

/**
 * The classes whose material actually answered: distinct non-null classIds of
 * the chunks used. General/library chunks (classId null) tag nothing.
 */
export function answeringClassIds(chunks: Array<{ classId: string | null }>): string[] {
  return Array.from(new Set(chunks.map((c) => c.classId).filter((c): c is string => Boolean(c))));
}

/** Messages for a question the pre-screen flagged as distress. */
function buildDistressMessages(query: string): ChatMessage[] {
  return [
    { role: "system", content: DISTRESS_PROMPT_ADDITION },
    { role: "user", content: redactPII(query) },
  ];
}

async function activeEnrollmentClassIds(userId: string): Promise<string[]> {
  const rows = await prisma.enrollment.findMany({
    where: { studentId: userId, status: "ACTIVE" },
    select: { classId: true },
  });
  return rows.map((r) => r.classId);
}

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

  // 0. SAFETY: screen the question before any provider call.
  const screen = prescreenQuery(request.query);
  if (screen.action === "block") {
    return { answer: getSafeResponse(request.locale), sources: [], chunksUsed: 0, latencyMs: Date.now() - start };
  }
  if (screen.action === "support") {
    const answer = await generateCompletion(buildDistressMessages(request.query));
    return { answer, sources: [], chunksUsed: 0, latencyMs: Date.now() - start };
  }

  // PRIVACY: the provider gets the question with emails/phones redacted.
  const llmQuery = redactPII(request.query);

  // 1. Embed the query
  const queryEmbedding = await generateEmbedding(llmQuery);

  // 2. Search the student's enrolled classes first, then general material.
  const enrolledClassIds = await activeEnrollmentClassIds(request.userId);
  const chunks =
    enrolledClassIds.length > 0
      ? await enrollmentAwareSearch(queryEmbedding, enrolledClassIds)
      : await similaritySearch(queryEmbedding);

  // 3. Handle no results — fall back to general-knowledge answer with a clear
  //    disclaimer instead of bouncing the student with a static "no materials"
  //    message. Students still get a useful reply before any ingestion happens.
  if (chunks.length === 0) {
    const generalMessages = buildGeneralKnowledgeMessages(llmQuery, request.locale);
    const generalAnswer = await generateCompletion(generalMessages);
    const answer = buildGeneralKnowledgeDisclaimer(request.locale) + generalAnswer;
    return {
      answer: classifyContent(answer, request.query).safe ? answer : getSafeResponse(request.locale),
      sources: [],
      chunksUsed: 0,
      latencyMs: Date.now() - start,
    };
  }

  // 4. Build RAG prompt
  const messages = buildRagMessages({
    query: llmQuery,
    locale: request.locale,
    chunks: chunks.map((c) => ({
      content: c.content,
      sourceTitle: c.sourceTitle,
      similarity: c.similarity,
    })),
  });

  // 5. Generate answer. Not streamed, so the safety check CAN stop it here.
  const generated = await generateCompletion(messages);
  const answer = classifyContent(generated, request.query).safe ? generated : getSafeResponse(request.locale);

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
  // Known up front so the client can attach thumbs-up/down to this answer
  // (sent in the "done" event; stored as AIInteraction.id).
  const interactionId = randomUUID();

  return new ReadableStream({
    async start(controller) {
      const start = Date.now();
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        // 0. SAFETY: screen the QUESTION before anything is generated. The
        //    post-generation checks further down run after the answer has
        //    already streamed, so they can only log — this is the gate.
        const screen = prescreenQuery(request.query);
        if (screen.action === "block") {
          const safe = getSafeResponse(request.locale);
          send({ type: "text", content: safe });
          send({ type: "done", latencyMs: Date.now() - start, interactionId });
          controller.close();
          void recordScreenedInteraction(request, interactionId, safe, "blocked", screen, start);
          return;
        }
        if (screen.action === "support") {
          let reply = "";
          await streamCompletionWithFallback(buildDistressMessages(request.query), {
            onToken(token) {
              reply += token;
              send({ type: "text", content: token });
            },
            onDone() {
              send({ type: "done", latencyMs: Date.now() - start, interactionId });
              controller.close();
              void recordScreenedInteraction(request, interactionId, reply, "distress", screen, start);
            },
            onError() {
              send({ type: "error", message: STREAM_FAILURE_MESSAGE });
              controller.close();
            },
          });
          return;
        }

        // 1. Build student context (parallel data fetch)
        const studentContext = await buildStudentContext(request.userId, request.query);
        const enrolledClassIds = studentContext.enrolledClasses.map((c) => c.classId);

        // 2. Cache — scoped to THIS user and their enrolled classes, so a cached
        //    (personalized) answer can never reach another student.
        const cacheScope: CacheScope = { userId: request.userId, classScope: enrolledClassIds };
        const cached = await checkCache(request.query, cacheScope);
        if (cached) {
          if (cached.sources) {
            try {
              send({ type: "sources", sources: JSON.parse(cached.sources), chunksUsed: 0 });
            } catch {
              /* skip malformed sources */
            }
          }
          send({ type: "text", content: cached.answer });
          send({ type: "done", latencyMs: Date.now() - start, cached: true, interactionId });
          controller.close();

          // Log cache hit interaction (fire-and-forget)
          logInteraction({
            id: interactionId,
            userId: request.userId,
            query: request.query,
            answer: cached.answer,
            sources: cached.sources ?? undefined,
            provider: "cache",
            mode: studentContext.detectedMode,
            startTime: start,
          }).catch(() => {});
          return;
        }

        // PRIVACY: strip the student's name from the context, and emails /
        // phone numbers from the question, before anything goes to a provider.
        const { sanitizedContext } = stripPIIFromContext(studentContext);
        const llmQuery = redactPII(request.query);

        // Send detected mode to client
        send({ type: "mode", mode: studentContext.detectedMode });

        // 3. Embed the query
        const queryEmbedding = await generateEmbedding(llmQuery);

        // 4. Enrollment-aware vector search
        const chunks =
          enrolledClassIds.length > 0
            ? await enrollmentAwareSearch(queryEmbedding, enrolledClassIds)
            : await similaritySearch(queryEmbedding);

        // SAFETY: Calculate confidence from retrieval quality
        const confidence = calculateConfidence(chunks, studentContext.detectedMode);
        send({ type: "confidence", level: confidence.level, label: confidence.label, labelDari: confidence.labelDari });

        // 5. Handle no results — stream a general-knowledge answer from the LLM
        //    with a clear disclaimer instead of dead-ending the conversation.
        if (chunks.length === 0) {
          const disclaimer = buildGeneralKnowledgeDisclaimer(request.locale);
          send({ type: "text", content: disclaimer });

          const generalMessages = buildGeneralKnowledgeMessages(llmQuery, request.locale);
          let generalAnswer = "";
          let usedProviderNoCtx = "groq";

          await streamCompletionWithFallback(generalMessages, {
            onToken(token) {
              generalAnswer += token;
              send({ type: "text", content: token });
            },
            onDone() {
              send({ type: "done", sources: [], chunksUsed: 0, latencyMs: Date.now() - start, interactionId });
              controller.close();

              logInteraction({
                id: interactionId,
                userId: request.userId,
                query: request.query,
                answer: disclaimer + generalAnswer,
                provider: usedProviderNoCtx,
                mode: studentContext.detectedMode,
                startTime: start,
              }).catch(() => {});
            },
            onProvider(name) {
              usedProviderNoCtx = name;
            },
            onError() {
              // If the LLM also fails, fall back to the static no-context message
              const fallback = buildNoContextMessage(request.locale);
              send({ type: "text", content: fallback });
              send({ type: "done", sources: [], chunksUsed: 0, latencyMs: Date.now() - start, llmError: true });
              controller.close();
            },
          });
          return;
        }

        // 6. Send sources metadata
        const sources = deduplicateSources(chunks);
        const sourcesJson = JSON.stringify(sources);
        send({ type: "sources", sources, chunksUsed: chunks.length });

        // 7. A/B TESTING: Assign prompt variant
        const abResult = assignVariant(request.userId);

        // 8. Build intelligent, personalized prompt (with PII-stripped context)
        const promptChunks = chunks.map((c) => ({
          content: c.content,
          source: c.sourceTitle,
          classId: c.classId,
        }));

        const confidenceWarning =
          confidence.level === "low"
            ? "WARNING: Very little relevant material was found. Be honest about your uncertainty. Suggest the student ask their teacher."
            : "";

        const messages = buildIntelligentPrompt(
          sanitizedContext,
          promptChunks,
          llmQuery,
          request.locale,
          {
            confidenceWarning,
            abTestAddition: abResult?.promptAddition,
          },
        );

        // PRIVACY: log-only final scan over EVERY message (course material may
        // legitimately contain a contact address; the student's own text was
        // already redacted above).
        const piiScan = scanPromptForPII(messages);
        if (!piiScan.clean) {
          console.warn("[Privacy] PII-like text in prompt:", piiScan.findings);
        }

        // 9. Stream LLM response with fallback
        let fullAnswer = "";
        let usedProvider = "groq";

        await streamCompletionWithFallback(messages, {
          onToken(token) {
            fullAnswer += token;
            send({ type: "text", content: token });
          },
          onDone() {
            send({ type: "done", latencyMs: Date.now() - start, interactionId });
            controller.close();

            // === Background: log + safety log + cache + sampled evaluation ===
            backgroundPostProcess({
              interactionId,
              userId: request.userId,
              query: request.query,
              locale: request.locale,
              fullAnswer,
              sourcesJson,
              chunkContents: chunks.map((c) => c.content),
              provider: usedProvider,
              mode: studentContext.detectedMode,
              answeringClassIds: answeringClassIds(chunks),
              cacheScope,
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
          onError() {
            send({ type: "error", message: STREAM_FAILURE_MESSAGE });
            controller.close();
          },
        });
      } catch (error) {
        // Raw error text (DB/provider internals) stays in the server log.
        console.error("[AI] RAG stream failed:", error);
        send({ type: "error", message: STREAM_FAILURE_MESSAGE });
        controller.close();
      }
    },
  });
}

/**
 * Log an answer that the question pre-screen handled (refused or answered in
 * "support" mode), plus a safety-log row so staff can see it in the review UI.
 */
async function recordScreenedInteraction(
  request: RagRequest,
  interactionId: string,
  answer: string,
  provider: string,
  screen: PrescreenResult,
  startTime: number,
): Promise<void> {
  const interaction = await logInteraction({
    id: interactionId,
    userId: request.userId,
    query: request.query,
    answer,
    provider,
    mode: "study",
    startTime,
  });
  try {
    await prisma.aISafetyLog.create({
      data: {
        interactionId: interaction?.id || null,
        confidenceScore: 0,
        confidenceLevel: "low",
        safetyPassed: screen.action !== "block",
        safetyCategory: screen.category,
        safetyAction: screen.action === "block" ? "block" : "warn",
        guardrailViolations: screen.reason ? JSON.stringify([screen.reason]) : null,
      },
    });
  } catch (err) {
    console.error("[Safety] Logging failed:", (err as Error).message);
  }
}

/**
 * Background post-processing: log, safety check, cache, sampled evaluation.
 *
 * Runs after the answer has fully streamed, so the safety checks here can only
 * RECORD a problem (AISafetyLog, for staff review) — the student already saw
 * the text. Blocking happens earlier, in prescreenQuery. A flagged answer is at
 * least never cached, so it is not served again.
 */
async function backgroundPostProcess(params: {
  interactionId: string;
  userId: string;
  query: string;
  locale: string;
  fullAnswer: string;
  sourcesJson: string;
  chunkContents: string[];
  provider: string;
  mode: AiMode;
  answeringClassIds: string[];
  cacheScope: CacheScope;
  confidence: { score: number; level: string };
  abVariant: string | null;
  studentLevel: string | null;
  startTime: number;
}): Promise<void> {
  // 1. Log the interaction
  const interaction = await logInteraction({
    id: params.interactionId,
    userId: params.userId,
    query: params.query,
    answer: params.fullAnswer,
    sources: params.sourcesJson,
    provider: params.provider,
    mode: params.mode,
    classIds: params.answeringClassIds,
    startTime: params.startTime,
  });

  // 2. SAFETY: post-generation checks (record-only on this streaming path)
  const safetyResult = classifyContent(params.fullAnswer, params.query);
  const guardrailResult = checkGuardrails(
    params.fullAnswer,
    params.chunkContents,
    params.query,
  );

  // 3. Cache the response — only a clean one, and only under this user's scope.
  if (params.fullAnswer.length > 50 && safetyResult.safe && guardrailResult.passed) {
    cacheResponse({
      question: params.query,
      questionLang: detectLanguage(params.query),
      answer: params.fullAnswer,
      sources: params.sourcesJson,
      provider: params.provider,
      scope: params.cacheScope,
    }).catch(() => {});
  }

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
    console.warn(`[Safety] Flagged (already shown) response for user ${params.userId}: ${safetyResult.reason}`);
  }
  if (guardrailResult.violations.length > 0) {
    console.warn(
      `[Guardrails] Violations: ${guardrailResult.violations.map((v) => v.principle).join(", ")}`,
    );
  }

  // 4. EVALUATION: grade a SAMPLE of answers (each grade is another model call).
  if (interaction && shouldEvaluate()) {
    evaluateAndStore(interaction.id, {
      question: redactPII(params.query),
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
  /** Pre-generated id (sent to the client for feedback); omitted → cuid. */
  id?: string;
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
        ...(params.id && { id: params.id }),
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
