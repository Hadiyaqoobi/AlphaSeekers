/**
 * PUT /api/admin/posts/[id]/feature
 *
 * Admin: toggle the featured flag on a post.
 * Body: { featured: boolean }
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Admin access required");

  const body = await request.json().catch(() => null);
  if (typeof body?.featured !== "boolean") {
    return badRequest("Required: featured (boolean)");
  }

  const updated = await prisma.studentPost.update({
    where: { id: params.id },
    data: { featured: body.featured },
  });

  return Response.json(updated);
}
