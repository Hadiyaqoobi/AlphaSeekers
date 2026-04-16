/**
 * POST /api/learn/generate-path
 *
 * Body: { topic: string, level?: "beginner" | "elementary" | "intermediate" }
 *
 * Generates a structured 4-6 lesson curriculum for any topic, stores it as
 * a LearningPath, returns it to the client.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { generateCompletion } from "@/lib/ai/llm";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { checkRateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  topic: z.string().trim().min(2).max(200),
  level: z.enum(["beginner", "elementary", "intermediate"]).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.approved) return forbidden("Account pending approval");

  if (!aiConfig.enabled) {
    return Response.json({ message: "AI not configured" }, { status: 503 });
  }

  // Rate limit: 10 path generations per hour (each one is a big LLM call)
  const rl = checkRateLimit(`learn-path:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return Response.json(
      { message: "You've started a lot of paths! Try one of your existing ones." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Topic must be 2-200 characters");

  const { topic, level } = parsed.data;

  const pathPrompt = `You are an expert curriculum designer creating a self-paced learning path for an Afghan student.

TOPIC: "${topic}"
STUDENT LEVEL: ${level || "beginner"}
STUDENT LANGUAGE: The student speaks Dari and is learning in English. Use simple vocabulary.

Create a structured learning path with 4-6 short lessons. Each lesson should take 10-15 minutes.

Respond ONLY with this JSON format, no other text:
{
  "title": "Learning path title",
  "description": "One sentence description",
  "estimatedHours": 2,
  "lessons": [
    {
      "number": 1,
      "title": "Lesson title",
      "description": "What the student will learn",
      "concepts": ["concept1", "concept2", "concept3"],
      "difficulty": "beginner"
    }
  ]
}

RULES:
- Start from the very basics (assume no prior knowledge)
- Each lesson builds on the previous one
- Use simple, clear language (B1 English level)
- Make lesson titles specific and inviting, not generic
- Include practical exercises in the concept list`;

  let path: { title: string; description?: string; estimatedHours?: number; lessons: unknown[] };
  try {
    const response = await generateCompletion([
      { role: "system", content: "You are a strict JSON-only curriculum designer." },
      { role: "user", content: pathPrompt },
    ]);
    const cleaned = response.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    path = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(path.lessons) || path.lessons.length === 0) {
      throw new Error("No lessons returned");
    }
  } catch (err) {
    console.error("[Learn] Path generation failed:", err);
    return Response.json(
      { message: "Couldn't generate that learning path. Try a different topic." },
      { status: 500 },
    );
  }

  const saved = await prisma.learningPath.create({
    data: {
      userId: user.id,
      topic,
      title: path.title,
      description: path.description || null,
      estimatedHours: path.estimatedHours || null,
      lessons: path.lessons as object,
      currentLesson: 1,
      status: "in_progress",
    },
  });

  return Response.json({
    id: saved.id,
    title: saved.title,
    description: saved.description,
    estimatedHours: saved.estimatedHours,
    lessons: path.lessons,
  });
}
