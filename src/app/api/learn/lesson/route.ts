/**
 * POST /api/learn/lesson
 *
 * Body: { pathId: string, lessonNumber: number }
 *
 * Generates the full lesson content (sections array). Caches by upserting
 * into LessonProgress, so the same lesson re-uses content on subsequent visits.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { generateCompletion } from "@/lib/ai/llm";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";

const schema = z.object({
  pathId: z.string().min(1),
  lessonNumber: z.number().int().positive(),
});

type LessonOutline = {
  number: number;
  title: string;
  description?: string;
  concepts?: string[];
  difficulty?: string;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.approved) return forbidden("Account pending approval");

  if (!aiConfig.enabled) {
    return Response.json({ message: "AI not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Required: pathId, lessonNumber");

  const { pathId, lessonNumber } = parsed.data;

  const path = await prisma.learningPath.findUnique({ where: { id: pathId } });
  if (!path || path.userId !== user.id) {
    return Response.json({ message: "Path not found" }, { status: 404 });
  }

  const lessons = (path.lessons as LessonOutline[]) || [];
  const outline = lessons[lessonNumber - 1];
  if (!outline) {
    return Response.json({ message: "Lesson not in path" }, { status: 404 });
  }

  // Check if we've already generated this lesson — return cached content
  const existing = await prisma.lessonProgress.findUnique({
    where: { pathId_lessonNumber: { pathId, lessonNumber } },
  });
  if (existing?.content) {
    // Mark started if first visit
    if (!existing.startedAt) {
      await prisma.lessonProgress.update({
        where: { id: existing.id },
        data: { startedAt: new Date() },
      });
    }
    return Response.json({
      sections: existing.content,
      pathTitle: path.title,
      lessonTitle: outline.title,
      totalLessons: lessons.length,
      progress: existing,
    });
  }

  const lessonPrompt = `You are a patient, encouraging tutor creating a lesson for an Afghan student.

LEARNING PATH: "${path.title}"
LESSON ${lessonNumber} OF ${lessons.length}: "${outline.title}"
LESSON DESCRIPTION: "${outline.description || ""}"
CONCEPTS TO COVER: ${(outline.concepts || []).join(", ")}
DIFFICULTY: ${outline.difficulty || "beginner"}

Create a complete, interactive lesson. Respond ONLY with this exact JSON shape, no other text:
{
  "sections": [
    { "type": "explanation", "title": "...", "content": "Clear explanation in 3-5 short paragraphs. Use simple English. Include real-world examples and analogies." },
    { "type": "example", "title": "...", "content": "A concrete, relatable example.", "code": "// optional code block if a coding topic — otherwise omit" },
    { "type": "key_point", "title": "Remember this", "points": ["Key point 1", "Key point 2", "Key point 3"] },
    { "type": "try_it", "title": "Your turn", "prompt": "A specific exercise the student can try.", "hint": "A helpful hint" },
    { "type": "vocabulary", "title": "New words", "words": [{ "term": "word", "definition": "simple definition", "dari": "Dari translation", "example": "Used in a sentence" }] },
    { "type": "quiz", "title": "Quick check", "questions": [{ "question": "...", "options": ["A","B","C","D"], "correct": 1, "explanation": "Why this is correct" }] },
    { "type": "summary", "title": "What you learned", "content": "2-3 sentence summary.", "nextPreview": "Brief teaser of the next lesson." }
  ]
}

RULES:
- Use analogies an Afghan teenager can relate to
- Include Dari translations for important vocabulary
- The quiz must have EXACTLY 3 questions: 1 easy, 1 medium, 1 challenging
- The "try it" exercise must be something the student can do in their head or on paper
- Keep everything at B1 English level
- Be warm and encouraging
- If the topic is coding, include runnable code examples
- The "code" field is OPTIONAL — only include for technical topics`;

  let lessonContent: { sections: unknown[] };
  try {
    const response = await generateCompletion([
      { role: "system", content: "You are a strict JSON-only lesson generator." },
      { role: "user", content: lessonPrompt },
    ]);
    const cleaned = response.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    lessonContent = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(lessonContent.sections)) {
      throw new Error("Sections is not an array");
    }
  } catch (err) {
    console.error("[Learn] Lesson generation failed:", err);
    return Response.json(
      { message: "Couldn't generate the lesson. Please try again." },
      { status: 500 },
    );
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { pathId_lessonNumber: { pathId, lessonNumber } },
    update: {
      content: lessonContent.sections as object,
      startedAt: new Date(),
    },
    create: {
      pathId,
      lessonNumber,
      userId: user.id,
      content: lessonContent.sections as object,
      startedAt: new Date(),
    },
  });

  return Response.json({
    sections: lessonContent.sections,
    pathTitle: path.title,
    lessonTitle: outline.title,
    totalLessons: lessons.length,
    progress,
  });
}
