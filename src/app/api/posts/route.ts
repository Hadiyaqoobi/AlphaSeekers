/**
 * GET /api/posts
 *
 * Public — list published posts.
 * Query params:
 *   type      — filter by type (article, poetry, art, spotlight, creative_writing)
 *   language  — filter by language (en, da, both)
 *   category  — filter by category
 *   page      — pagination (default 1)
 *   pageSize  — items per page (default 12)
 */

import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/security/cors";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const language = searchParams.get("language");
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10)));

  const where: Record<string, unknown> = { status: "published" };
  if (type) where.type = type;
  if (category) where.category = category;
  if (language) {
    if (language === "da") {
      where.language = { in: ["da", "both"] };
    } else if (language === "en") {
      where.language = { in: ["en", "both"] };
    } else {
      where.language = language;
    }
  }

  const [posts, total] = await Promise.all([
    prisma.studentPost.findMany({
      where,
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        type: true,
        title: true,
        titleDari: true,
        excerpt: true,
        excerptDari: true,
        coverImageUrl: true,
        galleryUrls: true,
        language: true,
        category: true,
        tags: true,
        readTimeMin: true,
        featured: true,
        anonymous: true,
        viewCount: true,
        likeCount: true,
        publishedAt: true,
        author: { select: { name: true } },
      },
    }),
    prisma.studentPost.count({ where }),
  ]);

  return withCors(
    Response.json({
      posts: posts.map((p) => shapePost(p)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    }),
    request,
  );
}

function shapePost(p: {
  anonymous: boolean;
  author: { name: string };
  [k: string]: unknown;
}) {
  return {
    ...p,
    author: p.anonymous ? { name: "Anonymous" } : p.author,
  };
}
