/**
 * GET /api/admin/posts
 *
 * Admin: list all posts, optionally filtered by status.
 */

import { prisma } from "@/lib/prisma";
import { AccessError, requirePermission } from "@/lib/security/permissions";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";

export async function GET(request: Request) {
  try {
    await requirePermission("content.view");
  } catch (e) {
    if (e instanceof AccessError) return Response.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "ADMIN") return forbidden("Admin access required");

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;

  const [posts, total] = await Promise.all([
    prisma.studentPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.studentPost.count({ where }),
  ]);

  return Response.json({ posts, total, page, pageSize });
}
