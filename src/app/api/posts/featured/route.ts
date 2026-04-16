/**
 * GET /api/posts/featured
 *
 * Public — featured published posts (up to 2).
 */

import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/security/cors";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const posts = await prisma.studentPost.findMany({
    where: { status: "published", featured: true },
    orderBy: { publishedAt: "desc" },
    take: 2,
    select: {
      id: true,
      slug: true,
      type: true,
      title: true,
      titleDari: true,
      excerpt: true,
      excerptDari: true,
      coverImageUrl: true,
      language: true,
      readTimeMin: true,
      anonymous: true,
      likeCount: true,
      publishedAt: true,
      author: { select: { name: true } },
    },
  });

  return withCors(
    Response.json({
      posts: posts.map((p) => ({
        ...p,
        author: p.anonymous ? { name: "Anonymous" } : p.author,
      })),
    }),
    request,
  );
}
