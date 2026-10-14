/**
 * POST /api/classes/[id]/sessions/[sessionId]/quiz
 *
 * Generate a 5-question quiz from the session's PUBLISHED (teacher-approved)
 * summary. Teacher (or admin) only. Requires summary to exist.
 *
 * GET returns the existing quiz (any session participant).
 */

import { prisma } from "@/lib/prisma";
import { generatePostClassQuiz } from "@/lib/ai/session/quiz-generator";
import { AI_NOT_CONFIGURED_MESSAGE, aiConfig } from "@/lib/ai/config";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });

  const summary = await prisma.sessionSummary.findUnique({
    where: { sessionId: params.sessionId },
    select: { quizData: true },
  });

  if (!summary?.quizData) {
    return Response.json({ message: "No quiz available yet" }, { status: 404 });
  }

  try {
    const quiz = JSON.parse(summary.quizData);
    return Response.json(quiz);
  } catch {
    return Response.json({ message: "Quiz data malformed" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });
  if (access.role !== "teacher" && access.role !== "admin") {
    return forbidden("Only teachers and admins can generate quizzes");
  }

  // Built from the summary text only — an LLM key is enough.
  if (!aiConfig.llmEnabled) {
    return Response.json({ message: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  const summary = await prisma.sessionSummary.findUnique({
    where: { sessionId: params.sessionId },
  });
  if (!summary) {
    return Response.json(
      { message: "Generate and publish a session summary first before creating a quiz" },
      { status: 409 },
    );
  }

  // Same teacher-side generation budget as the summary.
  const rl = await checkRateLimitDistributed(`ai-teacher-gen:${user.id}`, aiConfig.rateLimits.teacherGenerate);
  if (!rl.allowed) {
    const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
    return Response.json(
      { message: "Too many AI generations. Please wait before trying again.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  try {
    const quiz = await generatePostClassQuiz(summary.content);
    await prisma.sessionSummary.update({
      where: { sessionId: params.sessionId },
      data: { quizData: JSON.stringify(quiz) },
    });

    return Response.json({ ok: true, quiz });
  } catch (err) {
    console.error("[Quiz] Generation failed:", err);
    return Response.json({ message: "Failed to generate quiz" }, { status: 500 });
  }
}
