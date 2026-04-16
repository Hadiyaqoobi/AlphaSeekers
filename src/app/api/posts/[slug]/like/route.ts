/**
 * POST /api/posts/[slug]/like
 *
 * Toggle like on a post. Requires auth.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/security/session";

export async function POST(_request: Request, { params }: { params: { slug: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const post = await prisma.studentPost.findUnique({
    where: { slug: params.slug },
    select: { id: true, status: true },
  });

  if (!post || post.status !== "published") {
    return Response.json({ message: "Post not found" }, { status: 404 });
  }

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId: post.id, userId: user.id } },
  });

  if (existing) {
    // Unlike
    await prisma.$transaction([
      prisma.postLike.delete({ where: { id: existing.id } }),
      prisma.studentPost.update({
        where: { id: post.id },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    return Response.json({ liked: false });
  }

  // Like
  await prisma.$transaction([
    prisma.postLike.create({
      data: { postId: post.id, userId: user.id },
    }),
    prisma.studentPost.update({
      where: { id: post.id },
      data: { likeCount: { increment: 1 } },
    }),
  ]);
  return Response.json({ liked: true });
}
