/**
 * GET /api/posts/[slug]
 *
 * Public — get a single published post by slug (with full content).
 * Also returns 3 "more posts" for the footer.
 */

import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/security/cors";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const post = await prisma.studentPost.findUnique({
    where: { slug: params.slug },
    include: {
      author: { select: { name: true } },
    },
  });

  if (!post || post.status !== "published") {
    return withCors(Response.json({ message: "Post not found" }, { status: 404 }), request);
  }

  const morePosts = await prisma.studentPost.findMany({
    where: {
      status: "published",
      id: { not: post.id },
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: {
      id: true,
      slug: true,
      type: true,
      title: true,
      titleDari: true,
      excerpt: true,
      coverImageUrl: true,
      readTimeMin: true,
      anonymous: true,
      likeCount: true,
      publishedAt: true,
      author: { select: { name: true } },
    },
  });

  return withCors(
    Response.json({
      post: {
        ...post,
        author: post.anonymous ? { name: "Anonymous" } : post.author,
      },
      morePosts: morePosts.map((p) => ({
        ...p,
        author: p.anonymous ? { name: "Anonymous" } : p.author,
      })),
    }),
    request,
  );
}
