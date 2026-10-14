/**
 * AI Review Queue — Human-in-the-loop evaluation calibration.
 *
 * GET:  Fetch the 20 lowest-scored unreviewed responses for review.
 * POST: Submit a human review for calibration against automated scores.
 *
 * SCOPE: staff holding ai.manage see every class. A teacher sees (and may
 * review) only answers tagged with a class they teach — previously any teacher
 * could read every student's raw questions across the platform and overwrite
 * any evaluation with arbitrary numbers.
 */

import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/security/api-guard";
import { getAccessControl } from "@/lib/security/permissions";
import { getSessionUser, unauthorized, badRequest, forbidden } from "@/lib/security/session";
import { logAuditEvent } from "@/lib/ai/privacy/audit-trail";
import { clampScore } from "@/lib/ai/evaluation/llm-judge";
import { taggedWithClass } from "@/lib/ai/offline/pack-generator";

/**
 * null = may see every class (ai.manage); otherwise the ids of the classes the
 * teacher teaches. Returns a Response when the caller may not use the queue.
 */
async function reviewerScope(): Promise<{ classIds: string[] | null; userId: string } | Response> {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  if (user.role !== "TEACHER") {
    const g = await guardPermission("ai.manage");
    if (!g.ok) return g.response;
    return { classIds: null, userId: user.id };
  }

  // Teachers: live DB check (deactivation applies immediately), own classes only.
  const access = await getAccessControl();
  if (!access || access.deactivated) return forbidden("Account deactivated");
  const classes = await prisma.class.findMany({ where: { teacherId: user.id }, select: { id: true } });
  return { classIds: classes.map((c) => c.id), userId: user.id };
}

function visibleTo(classIds: string[] | null, interactionClassIds: string | null): boolean {
  return classIds === null || classIds.some((id) => taggedWithClass(interactionClassIds, id));
}

export async function GET() {
  const scope = await reviewerScope();
  if (scope instanceof Response) return scope;
  if (scope.classIds !== null && scope.classIds.length === 0) {
    return Response.json({ queue: [] });
  }

  const items = await prisma.aIEvaluation.findMany({
    where: {
      humanReviewed: false,
      ...(scope.classIds !== null && {
        interaction: { OR: scope.classIds.map((id) => ({ classIds: { contains: id } })) },
      }),
    },
    orderBy: { overall: "asc" },
    take: 20,
    include: {
      interaction: {
        select: { query: true, answer: true, mode: true, createdAt: true, classIds: true },
      },
    },
  });

  // `contains` is a substring match; confirm exact class membership.
  const queue = items.filter((item) => visibleTo(scope.classIds, item.interaction.classIds));

  return Response.json({ queue });
}

export async function POST(request: Request) {
  const scope = await reviewerScope();
  if (scope instanceof Response) return scope;

  const body = await request.json().catch(() => null);
  const humanAccuracy = clampScore(body?.humanAccuracy);
  const humanPedagogy = clampScore(body?.humanPedagogy);
  const humanSafety = clampScore(body?.humanSafety);
  const humanCompleteness = clampScore(body?.humanCompleteness);
  if (
    typeof body?.evaluationId !== "string" ||
    humanAccuracy === null ||
    humanPedagogy === null ||
    humanSafety === null ||
    humanCompleteness === null
  ) {
    return badRequest(
      "Required: evaluationId, humanAccuracy, humanPedagogy, humanSafety, humanCompleteness (all 0-1)",
    );
  }

  const evaluation = await prisma.aIEvaluation.findUnique({
    where: { id: body.evaluationId },
    select: { humanReviewed: true, interaction: { select: { classIds: true } } },
  });
  if (!evaluation || !visibleTo(scope.classIds, evaluation.interaction.classIds)) {
    return Response.json({ message: "Evaluation not found" }, { status: 404 });
  }
  if (evaluation.humanReviewed) {
    return Response.json({ message: "This answer has already been reviewed" }, { status: 409 });
  }

  const humanOverall =
    humanAccuracy * 0.3 +
    humanPedagogy * 0.25 +
    humanSafety * 0.3 +
    humanCompleteness * 0.15;

  // Conditional update: two reviewers racing on the same item — only one wins.
  const updated = await prisma.aIEvaluation.updateMany({
    where: { id: body.evaluationId, humanReviewed: false },
    data: {
      humanReviewed: true,
      humanAccuracy,
      humanPedagogy,
      humanSafety,
      humanCompleteness,
      humanOverall,
      humanNotes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
      reviewedBy: scope.userId,
      reviewedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    return Response.json({ message: "This answer has already been reviewed" }, { status: 409 });
  }

  await logAuditEvent({
    actorId: scope.userId,
    action: "ai.review_response",
    targetType: "evaluation",
    targetId: body.evaluationId,
    details: JSON.stringify({ humanOverall: humanOverall.toFixed(2) }),
  });

  return Response.json({ success: true });
}
