/**
 * PUT /api/admin/posts/[id]/review
 *
 * Admin: approve or reject a pending post.
 * Body: { action: "approve" | "reject", notes?: string }
 */

import { prisma } from "@/lib/prisma";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { logAuditEvent } from "@/lib/ai/privacy/audit-trail";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("content.moderate");
  } catch (e) {
    if (e instanceof AccessError) return Response.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Admin access required");

  const body = await request.json().catch(() => null);
  if (!body?.action || !["approve", "reject"].includes(body.action)) {
    return badRequest("Required: action ('approve' or 'reject')");
  }

  const post = await prisma.studentPost.findUnique({ where: { id: params.id } });
  if (!post) return Response.json({ message: "Not found" }, { status: 404 });

  if (body.action === "approve") {
    const updated = await prisma.studentPost.update({
      where: { id: params.id },
      data: {
        status: "published",
        publishedAt: new Date(),
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNotes: body.notes || null,
      },
    });

    await logAuditEvent({
      actorId: user.id,
      action: "ai.review_response",
      targetType: "student_post",
      targetId: params.id,
      details: JSON.stringify({ action: "approved", title: post.title }),
    });

    return Response.json(updated);
  }

  // Reject
  if (!body.notes || !body.notes.trim()) {
    return badRequest("Rejection requires feedback notes for the student");
  }

  const updated = await prisma.studentPost.update({
    where: { id: params.id },
    data: {
      status: "rejected",
      reviewedBy: user.id,
      reviewedAt: new Date(),
      reviewNotes: body.notes.trim(),
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "ai.review_response",
    targetType: "student_post",
    targetId: params.id,
    details: JSON.stringify({ action: "rejected", title: post.title }),
  });

  return Response.json(updated);
}
