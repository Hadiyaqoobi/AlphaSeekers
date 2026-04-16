/**
 * POST /api/learn/lesson/chat
 *
 * Body: { pathId, lessonNumber, query }
 *
 * Quick AI assistant scoped to the CURRENT lesson. The AI answers using only
 * the concepts in that specific lesson, not general knowledge or course materials.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { generateCompletion } from "@/lib/ai/llm";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized, badRequest } from "@/lib/security/session";

const schema = z.object({
  pathId: z.string().min(1),
  lessonNumber: z.number().int().positive(),
  query: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  if (!aiConfig.enabled) {
    return Response.json({ message: "AI not configured" }, { status: 503 });
  }

  const rl = checkRateLimit(`learn-chat:${user.id}`, { limit: 30, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return Response.json({ message: "Slow down — give me a moment to catch up." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request");

  const { pathId, lessonNumber, query } = parsed.data;

  const [path, progress] = await Promise.all([
    prisma.learningPath.findUnique({ where: { id: pathId } }),
    prisma.lessonProgress.findUnique({
      where: { pathId_lessonNumber: { pathId, lessonNumber } },
    }),
  ]);

  if (!path || path.userId !== user.id) {
    return Response.json({ message: "Path not found" }, { status: 404 });
  }

  // Build a concise lesson summary for the AI (so it stays scoped)
  let lessonContext = `Lesson ${lessonNumber}: ${path.title}`;
  if (progress?.content) {
    try {
      const sections = progress.content as Array<{ type: string; title?: string; content?: string }>;
      lessonContext = sections
        .filter((s) => s.type === "explanation" || s.type === "example" || s.type === "summary")
        .map((s) => `[${s.title || s.type}]\n${s.content || ""}`)
        .join("\n\n")
        .substring(0, 2500);
    } catch {
      /* fall through */
    }
  }

  const systemPrompt = `You are a quiet AI tutor helping a student understand a SPECIFIC lesson they're reading.

LESSON TOPIC: "${path.title}"
LESSON CONTENT (this is the only knowledge you should use):
${lessonContext}

RULES (strict):
- Answer in 2-4 short sentences max
- Use only concepts from THIS lesson
- If they ask about something NOT in this lesson, say: "Great question! That's covered later — for now, let's focus on what we just learned."
- Be warm, encouraging, simple English
- No greetings, no preamble`;

  try {
    const answer = await generateCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ]);
    return Response.json({ answer });
  } catch (err) {
    console.error("[Learn] lesson chat failed:", err);
    return Response.json(
      { message: "Couldn't answer right now. Try again in a sec." },
      { status: 500 },
    );
  }
}
