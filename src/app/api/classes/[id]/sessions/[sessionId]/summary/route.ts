/**
 * /api/classes/[id]/sessions/[sessionId]/summary
 *
 * Teacher-approved AI class summaries.
 *
 * The summary is shown to the whole class, and it is generated from student
 * notes and questions, so an AI draft must not reach students until the
 * teacher has read it. Drafts are therefore NOT written to SessionSummary
 * (every student view reads that table); they are kept in the audit log
 * (action "ai.summary_draft"), which doubles as the record of what the AI
 * produced versus what the teacher published.
 *
 * POST { action?: "generate" }          teacher/admin: new AI draft → { draft }
 * POST { action: "publish", content? }  teacher/admin: publish the (edited)
 *                                       text, or the latest draft if omitted
 * GET                                   teacher/admin: { published, draft }
 *                                       student:       { published }
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { AI_NOT_CONFIGURED_MESSAGE, aiConfig } from "@/lib/ai/config";
import { logAuditEvent } from "@/lib/ai/privacy/audit-trail";
import { generateSessionSummary } from "@/lib/ai/session/summary-generator";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

type Params = { params: { id: string; sessionId: string } };

const postSchema = z.object({
  action: z.enum(["generate", "publish"]).default("generate"),
  content: z.string().trim().min(20).max(20_000).optional(),
});

async function latestDraft(sessionId: string) {
  const row = await prisma.auditLog.findFirst({
    where: { action: "ai.summary_draft", targetType: "session", targetId: sessionId },
    orderBy: { createdAt: "desc" },
    select: { details: true, createdAt: true },
  });
  return row?.details ? { content: row.details, createdAt: row.createdAt } : null;
}

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });

  const published = await prisma.sessionSummary.findUnique({
    where: { sessionId: params.sessionId },
    select: { content: true, generatedAt: true },
  });

  if (access.role === "student") {
    return Response.json({ published });
  }
  return Response.json({ published, draft: await latestDraft(params.sessionId) });
}

export async function POST(request: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });
  if (access.role !== "teacher" && access.role !== "admin") {
    return forbidden("Only teachers and admins can generate summaries");
  }

  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body ?? {});
  if (!parsed.success) return badRequest("Invalid summary request");

  if (parsed.data.action === "publish") {
    const content = parsed.data.content ?? (await latestDraft(params.sessionId))?.content;
    if (!content) return badRequest("Nothing to publish — generate a draft first");

    const summary = await prisma.sessionSummary.upsert({
      where: { sessionId: params.sessionId },
      update: { content, generatedAt: new Date() },
      create: { sessionId: params.sessionId, content },
    });
    await logAuditEvent({
      actorId: user.id,
      action: "ai.summary_publish",
      targetType: "session",
      targetId: params.sessionId,
      details: JSON.stringify({ edited: parsed.data.content !== undefined, length: content.length }),
    });
    return Response.json({ ok: true, published: true, summary });
  }

  if (!aiConfig.llmEnabled) {
    return Response.json({ message: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  const rl = await checkRateLimitDistributed(`ai-teacher-gen:${user.id}`, aiConfig.rateLimits.teacherGenerate);
  if (!rl.allowed) {
    const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
    return Response.json(
      { message: "Too many AI generations. Please wait before trying again.", retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  try {
    const draft = await generateSessionSummary(params.sessionId);

    await logAuditEvent({
      actorId: user.id,
      action: "ai.summary_draft",
      targetType: "session",
      targetId: params.sessionId,
      details: draft,
    });

    return Response.json({ ok: true, published: false, draft });
  } catch (err) {
    console.error("[Summary] Generation failed:", err);
    return Response.json({ message: "Failed to generate summary" }, { status: 500 });
  }
}
