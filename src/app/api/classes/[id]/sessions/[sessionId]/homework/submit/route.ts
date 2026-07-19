/**
 * POST /api/classes/[id]/sessions/[sessionId]/homework/submit
 *
 * Student submits homework. Auto-runs AI review on the submission.
 * Body: { assignmentId, content?, fileUrl?, imageUrl? }
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { aiConfig } from "@/lib/ai/config";
import { generateCompletion } from "@/lib/ai/llm";
import { emit } from "@/lib/events/bus";
import { stripHtml } from "@/lib/security/sanitize";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

const submitSchema = z.object({
  assignmentId: z.string().min(1),
  content: z.string().max(20000).transform(stripHtml).optional(),
  fileUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });
  if (access.role !== "student") return forbidden("Only students submit homework");

  const body = await request.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid submission data");

  const data = parsed.data;
  if (!data.content && !data.fileUrl && !data.imageUrl) {
    return badRequest("Submission must include content, file, or image");
  }

  const assignment = await prisma.homeworkAssignment.findUnique({
    where: { id: data.assignmentId },
  });
  if (!assignment || assignment.sessionId !== params.sessionId) {
    return Response.json({ message: "Assignment not found" }, { status: 404 });
  }

  const submission = await prisma.homeworkSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId: data.assignmentId, studentId: user.id } },
    update: {
      content: data.content || null,
      fileUrl: data.fileUrl || null,
      imageUrl: data.imageUrl || null,
      submittedAt: new Date(),
      aiReview: null, // reset, will regenerate
    },
    create: {
      assignmentId: data.assignmentId,
      studentId: user.id,
      content: data.content || null,
      fileUrl: data.fileUrl || null,
      imageUrl: data.imageUrl || null,
    },
  });

  // Auto AI review (non-blocking — return submission immediately, generate review in background)
  if (data.content && aiConfig.enabled) {
    runAiReview(submission.id, assignment.title, assignment.description, data.content).catch(
      (err) => console.error("[Homework AI review] failed:", err),
    );
  }

  // Fan out a domain event so the teacher gets notified (runs in the worker).
  // Never let a queue hiccup break the submission itself.
  try {
    await emit(
      "homework.submitted",
      { homeworkId: submission.id, sessionId: params.sessionId, studentId: user.id },
      { dedupeKey: `homework.submitted:${submission.id}` },
    );
  } catch (err) {
    console.error("[Homework submit] emit failed:", err);
  }

  return Response.json({ ok: true, submission });
}

async function runAiReview(
  submissionId: string,
  title: string,
  description: string,
  studentWork: string,
): Promise<void> {
  const reviewPrompt = `Review this student's homework submission.

ASSIGNMENT: ${title}
INSTRUCTIONS: ${description}

STUDENT'S WORK:
${studentWork}

Provide:
1. OVERALL ASSESSMENT (1 sentence)
2. SPECIFIC FEEDBACK on each answer/section
3. CORRECTIONS for any mistakes (show correct version)
4. ENCOURAGEMENT — one specific thing they did well

Keep feedback constructive and kind. This student is learning.`;

  try {
    const review = await generateCompletion([
      {
        role: "system",
        content: "You are a kind, encouraging tutor providing homework feedback.",
      },
      { role: "user", content: reviewPrompt },
    ]);

    await prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: { aiReview: review },
    });
  } catch (err) {
    console.error("[Homework AI review] LLM failed:", err);
  }
}
