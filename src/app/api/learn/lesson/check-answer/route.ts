/**
 * POST /api/learn/lesson/check-answer
 *
 * Body: {
 *   pathId, lessonNumber, prompt (the exercise question), answer (student input),
 *   quizScore?: number (optional — if submitted alongside the quiz)
 * }
 *
 * Two roles:
 *  1. Evaluates the "Your turn" exercise via LLM, returns short encouraging feedback.
 *  2. If quizScore is sent, marks the lesson complete and unlocks the next one.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { generateCompletion } from "@/lib/ai/llm";
import { getSessionUser, unauthorized, badRequest } from "@/lib/security/session";

const schema = z.object({
  pathId: z.string().min(1),
  lessonNumber: z.number().int().positive(),
  prompt: z.string().min(1).max(2000),
  answer: z.string().max(5000),
  quizScore: z.number().min(0).max(1).optional(),
  markComplete: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request");

  const { pathId, lessonNumber, prompt, answer, quizScore, markComplete } = parsed.data;

  const path = await prisma.learningPath.findUnique({ where: { id: pathId } });
  if (!path || path.userId !== user.id) {
    return Response.json({ message: "Path not found" }, { status: 404 });
  }

  // If marking complete: update progress, advance currentLesson if needed
  if (markComplete && quizScore !== undefined) {
    await prisma.lessonProgress.upsert({
      where: { pathId_lessonNumber: { pathId, lessonNumber } },
      update: { completed: true, quizScore, completedAt: new Date() },
      create: {
        pathId,
        lessonNumber,
        userId: user.id,
        completed: true,
        quizScore,
        completedAt: new Date(),
        startedAt: new Date(),
      },
    });

    const lessons = (path.lessons as Array<unknown>) || [];
    const isLast = lessonNumber >= lessons.length;
    await prisma.learningPath.update({
      where: { id: pathId },
      data: {
        currentLesson: Math.min(lessonNumber + 1, lessons.length),
        status: isLast ? "completed" : "in_progress",
        completedAt: isLast ? new Date() : null,
      },
    });

    return Response.json({ ok: true, completed: true, isLast });
  }

  // Otherwise: AI feedback on the "Your turn" exercise
  if (!aiConfig.enabled || !answer.trim()) {
    return Response.json({
      feedback: "Type your answer first, then I'll give you feedback.",
      correct: false,
    });
  }

  const feedbackPrompt = `You are a kind, encouraging tutor checking a student's answer.

EXERCISE: "${prompt}"
STUDENT'S ANSWER: "${answer}"

Give SHORT feedback (2-3 sentences max):
- If correct or mostly correct: praise them briefly and add one small insight
- If partially right: acknowledge what they got right, then gently correct the rest
- If wrong: be kind, explain the right approach, give the correct answer

Respond ONLY with this JSON:
{ "correct": true, "feedback": "Your kind, short feedback here..." }

Be warm. Use simple English. Never make them feel bad.`;

  try {
    const raw = await generateCompletion([
      { role: "system", content: "You are a kind tutor. Respond ONLY with JSON." },
      { role: "user", content: feedbackPrompt },
    ]);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    if (result && typeof result.feedback === "string") {
      return Response.json({
        correct: Boolean(result.correct),
        feedback: result.feedback,
      });
    }
    throw new Error("Bad LLM response");
  } catch (err) {
    console.error("[Learn] check-answer failed:", err);
    return Response.json({
      correct: false,
      feedback:
        "Good try! I couldn't check your answer right now — keep going and ask the chat below if you're unsure.",
    });
  }
}
