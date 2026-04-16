/**
 * GET  /api/me/posts   — list the current user's posts (all statuses)
 * POST /api/me/posts   — create a new draft post
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { stripHtml } from "@/lib/security/sanitize";
import {
  generateUniqueSlug,
  estimateReadTime,
  generateExcerpt,
  isValidPostType,
} from "@/lib/stories/utils";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const posts = await prisma.studentPost.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      type: true,
      title: true,
      excerpt: true,
      coverImageUrl: true,
      status: true,
      featured: true,
      viewCount: true,
      likeCount: true,
      reviewNotes: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return Response.json({ posts });
}

const createSchema = z.object({
  type: z.string().refine(isValidPostType, "Invalid post type"),
  title: z.string().trim().min(3).max(200).transform(stripHtml).pipe(z.string().min(3)),
  titleDari: z.string().trim().max(200).transform(stripHtml).optional().nullable(),
  content: z.string().max(50000).optional().nullable(),
  contentDari: z.string().max(50000).optional().nullable(),
  excerpt: z.string().max(300).transform(stripHtml).optional().nullable(),
  excerptDari: z.string().max(300).transform(stripHtml).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  galleryUrls: z.array(z.string().url()).max(10).optional(),
  language: z.enum(["en", "da", "both"]).default("en"),
  category: z.string().max(50).transform(stripHtml).optional().nullable(),
  tags: z.array(z.string().max(30).transform(stripHtml)).max(10).optional(),
  anonymous: z.boolean().default(false),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.approved) return forbidden("Account pending approval");

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid post data: " + JSON.stringify(parsed.error.flatten().fieldErrors));
  }

  const data = parsed.data;
  const slug = await generateUniqueSlug(data.title);
  const excerpt = data.excerpt || generateExcerpt(data.content);
  const readTimeMin = estimateReadTime(data.content);

  const post = await prisma.studentPost.create({
    data: {
      authorId: user.id,
      type: data.type,
      title: data.title,
      titleDari: data.titleDari || null,
      slug,
      content: data.content || null,
      contentDari: data.contentDari || null,
      excerpt,
      excerptDari: data.excerptDari || null,
      coverImageUrl: data.coverImageUrl || null,
      galleryUrls: data.galleryUrls ? JSON.stringify(data.galleryUrls) : null,
      language: data.language,
      category: data.category || null,
      tags: data.tags?.join(",") || null,
      readTimeMin,
      anonymous: data.anonymous,
      status: "draft",
    },
  });

  return Response.json(post);
}
