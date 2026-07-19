/**
 * POST /api/ai/quick
 *
 * "Whisper mode" — quick AI for during a live class.
 * Short, focused answers (2-3 sentences). Optionally scoped to a classId.
 *
 * Body: { query: string, classId?: string, locale?: "en" | "fa" }
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { generateCompletion, isLlmUnavailable } from "@/lib/ai/llm";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { enrollmentAwareSearch, similaritySearch } from "@/lib/ai/vector-store";

const quickSchema = z.object({
  query: z.string().trim().min(3).max(500),
  classId: z.string().optional(),
  locale: z.enum(["en", "fa"]).default("en"),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.approved) return forbidden("Account pending approval");

  if (!aiConfig.enabled) {
    return Response.json({ message: "AI features not configured" }, { status: 503 });
  }

  // Per-user rate limit (distributed, DB-backed with in-memory fallback) so a
  // single student can't exhaust the shared AI quota / instance memory.
  const rl = await checkRateLimitDistributed(`ai-quick:${user.id}`, aiConfig.rateLimits.quick);
  if (!rl.allowed) {
    const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
    return Response.json(
      { message: "Slow down — give me a sec to catch up.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = quickSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid query");

  const { query, classId, locale } = parsed.data;

  try {
    // SCOPING (SECURITY): only scope to a classId the student is actually
    // enrolled in. An unenrolled/spoofed classId must not unlock that class's
    // materials — fall back to general/library material instead.
    let scopedClassId: string | null = null;
    if (classId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_classId: { studentId: user.id, classId } },
        select: { status: true },
      });
      if (enrollment && enrollment.status === "ACTIVE") {
        scopedClassId = classId;
      }
    }

    // 1. Embed and search within the authorized scope only
    const embedding = await generateEmbedding(query);
    const chunks = scopedClassId
      ? await enrollmentAwareSearch(embedding, [scopedClassId], 3)
      : await similaritySearch(embedding, 3);

    // 2. Get class name for context (only for the authorized class)
    let className: string | null = null;
    if (scopedClassId) {
      const cls = await prisma.class.findUnique({
        where: { id: scopedClassId },
        select: { name: true },
      });
      className = cls?.name || null;
    }

    const context = chunks.length > 0
      ? chunks.map((c, i) => `[${i + 1}: ${c.sourceTitle}]\n${c.content}`).join("\n\n")
      : "No specific course material was found for this question.";

    const systemPrompt = `You are a quiet AI tutor whispering an answer during a live class.

The student is currently in${className ? ` a live ${className} class` : " a live class"}.
They asked you a quick question without leaving the class.

RULES (very strict):
- Answer in 1-3 short sentences. NEVER more.
- No greetings, no "great question", no preamble.
- No follow-up offers like "want me to explain more?".
- Use simple words.
- If the answer isn't in the context below, say "Quick: not in your materials. Ask after class." in ${locale === "fa" ? "Dari" : "English"}.
- Respond in ${locale === "fa" ? "Dari" : "English"}.

CONTEXT:
${context}`;

    const answer = await generateCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ]);

    // Log the interaction (mode = "quick", scoped to classId)
    prisma.aIInteraction
      .create({
        data: {
          userId: user.id,
          query,
          answer,
          mode: "quick",
          classIds: scopedClassId,
          provider: "groq",
        },
      })
      .catch(() => {});

    return Response.json({
      answer,
      sources: chunks.slice(0, 3).map((c) => ({
        title: c.sourceTitle,
        relevance: c.similarity,
      })),
    });
  } catch (err) {
    // ERROR LEAKAGE FIX: log details server-side, return a generic, safe message
    // to the student. Surface a clean 503 when the AI providers are exhausted.
    console.error("[Quick AI] failed:", err);
    if (isLlmUnavailable(err)) {
      return Response.json(
        { message: "The AI is busy right now. Please try again in a moment." },
        { status: 503 },
      );
    }
    return Response.json(
      { message: "Quick AI is unavailable right now. Please try again." },
      { status: 500 },
    );
  }
}
