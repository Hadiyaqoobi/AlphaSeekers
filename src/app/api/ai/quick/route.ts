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
import { generateCompletion } from "@/lib/ai/llm";
import { checkRateLimit } from "@/lib/security/rate-limit";
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

  // Tighter rate limit for quick AI: 30 per 5 min
  const rl = checkRateLimit(`ai-quick:${user.id}`, { limit: 30, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return Response.json({ message: "Slow down — give me a sec to catch up." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = quickSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid query");

  const { query, classId, locale } = parsed.data;

  try {
    // 1. Embed and search (scoped to classId if provided)
    const embedding = await generateEmbedding(query);
    const chunks = classId
      ? await enrollmentAwareSearch(embedding, [classId], 3)
      : await similaritySearch(embedding, 3);

    // 2. Get class name for context
    let className: string | null = null;
    if (classId) {
      const cls = await prisma.class.findUnique({
        where: { id: classId },
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
          classIds: classId || null,
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
    console.error("[Quick AI] failed:", err);
    return Response.json(
      { message: (err as Error).message || "Quick AI failed" },
      { status: 500 },
    );
  }
}
