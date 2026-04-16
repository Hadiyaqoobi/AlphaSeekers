/**
 * POST /api/classes/[id]/sessions/[sessionId]/summary
 *
 * Teacher: trigger AI summary generation. Stores in SessionSummary.
 */

import { prisma } from "@/lib/prisma";
import { generateSessionSummary } from "@/lib/ai/session/summary-generator";
import { aiConfig } from "@/lib/ai/config";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

export async function POST(
  _request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) return Response.json({ message: access.message }, { status: access.status });
  if (access.role !== "teacher" && access.role !== "admin") {
    return forbidden("Only teachers and admins can generate summaries");
  }

  if (!aiConfig.enabled) {
    return Response.json({ message: "AI features not configured" }, { status: 503 });
  }

  try {
    const content = await generateSessionSummary(params.sessionId);

    const summary = await prisma.sessionSummary.upsert({
      where: { sessionId: params.sessionId },
      update: { content, generatedAt: new Date() },
      create: { sessionId: params.sessionId, content },
    });

    return Response.json({ ok: true, summary });
  } catch (err) {
    console.error("[Summary] Generation failed:", err);
    return Response.json(
      { message: (err as Error).message || "Failed to generate summary" },
      { status: 500 },
    );
  }
}
