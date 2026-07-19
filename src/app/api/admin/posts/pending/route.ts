/**
 * GET /api/admin/posts/pending
 *
 * Admin: posts awaiting review.
 */

import { prisma } from "@/lib/prisma";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";

export async function GET() {
  try {
    await requirePermission("content.view");
  } catch (e) {
    if (e instanceof AccessError) return Response.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Admin access required");

  const posts = await prisma.studentPost.findMany({
    where: { status: "pending_review" },
    orderBy: { updatedAt: "asc" }, // oldest first so nothing waits forever
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return Response.json({ posts, count: posts.length });
}
