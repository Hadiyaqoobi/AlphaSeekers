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
  // Explicit select (NEVER spread the raw record): authorId / reviewedBy / reviewedAt
  // / reviewNotes must never reach this PUBLIC endpoint — leaking authorId lets anyone
  // build an id→name map from non-anonymous posts and de-anonymize a student who
  // published a sensitive story as "anonymous".
  const post = await prisma.studentPost.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      type: true,
      title: true,
      titleDari: true,
      slug: true,
      content: true,
      contentDari: true,
      excerpt: true,
      excerptDari: true,
      coverImageUrl: true,
      galleryUrls: true,
      language: true,
      category: true,
      tags: true,
      readTimeMin: true,
      status: true,
      publishedAt: true,
      featured: true,
      anonymous: true,
      viewCount: true,
      likeCount: true,
      createdAt: true,
      updatedAt: true,
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
