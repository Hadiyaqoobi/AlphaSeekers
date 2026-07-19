/**
 * AI Review Queue — Human-in-the-loop evaluation calibration.
 *
 * GET:  Fetch the 20 lowest-scored unreviewed responses for teacher review.
 * POST: Submit a human review for calibration against automated scores.
 */

import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/security/api-guard";
import { getSessionUser, unauthorized, badRequest } from "@/lib/security/session";
import { logAuditEvent } from "@/lib/ai/privacy/audit-trail";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  // Teachers can review (for class-level calibration). Non-teachers must hold
  // the ai.manage permission (super admins and explicitly-granted employees).
  if (user.role !== "TEACHER") {
    const g = await guardPermission("ai.manage");
    if (!g.ok) return g.response;
  }

  const items = await prisma.aIEvaluation.findMany({
    where: { humanReviewed: false },
    orderBy: { overall: "asc" },
    take: 20,
    include: {
      interaction: {
        select: { query: true, answer: true, mode: true, createdAt: true },
      },
    },
  });

  return Response.json({ queue: items });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "TEACHER") {
    const g = await guardPermission("ai.manage");
    if (!g.ok) return g.response;
  }

  const body = await request.json().catch(() => null);
  if (
    !body?.evaluationId ||
    typeof body.humanAccuracy !== "number" ||
    typeof body.humanPedagogy !== "number" ||
    typeof body.humanSafety !== "number" ||
    typeof body.humanCompleteness !== "number"
  ) {
    return badRequest(
      "Required: evaluationId, humanAccuracy, humanPedagogy, humanSafety, humanCompleteness (all 0-1)",
    );
  }

  const humanOverall =
    body.humanAccuracy * 0.3 +
    body.humanPedagogy * 0.25 +
    body.humanSafety * 0.3 +
    body.humanCompleteness * 0.15;

  await prisma.aIEvaluation.update({
    where: { id: body.evaluationId },
    data: {
      humanReviewed: true,
      humanAccuracy: body.humanAccuracy,
      humanPedagogy: body.humanPedagogy,
      humanSafety: body.humanSafety,
      humanCompleteness: body.humanCompleteness,
      humanOverall,
      humanNotes: body.notes || null,
      reviewedBy: user.id,
      reviewedAt: new Date(),
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "ai.review_response",
    targetType: "evaluation",
    targetId: body.evaluationId,
    details: JSON.stringify({ humanOverall: humanOverall.toFixed(2) }),
  });

  return Response.json({ success: true });
}
