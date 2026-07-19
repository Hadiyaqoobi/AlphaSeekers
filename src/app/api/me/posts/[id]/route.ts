/**
 * GET    /api/me/posts/[id]   — get one of the user's own posts
 * PUT    /api/me/posts/[id]   — edit (only if draft or rejected)
 * DELETE /api/me/posts/[id]   — delete
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, forbidden, badRequest } from "@/lib/security/session";
import { getAccessControl, can } from "@/lib/security/permissions";
import { stripHtml } from "@/lib/security/sanitize";
import { estimateReadTime, generateExcerpt, isValidPostType } from "@/lib/stories/utils";

const updateSchema = z.object({
  type: z.string().refine(isValidPostType, "Invalid post type").optional(),
  title: z.string().trim().min(3).max(200).transform(stripHtml).pipe(z.string().min(3)).optional(),
  titleDari: z.string().trim().max(200).transform(stripHtml).optional().nullable(),
  content: z.string().max(50000).optional().nullable(),
  contentDari: z.string().max(50000).optional().nullable(),
  excerpt: z.string().max(300).transform(stripHtml).optional().nullable(),
  excerptDari: z.string().max(300).transform(stripHtml).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  galleryUrls: z.array(z.string().url()).max(10).optional(),
  language: z.enum(["en", "da", "both"]).optional(),
  category: z.string().max(50).transform(stripHtml).optional().nullable(),
  tags: z.array(z.string().max(30).transform(stripHtml)).max(10).optional(),
  anonymous: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const post = await prisma.studentPost.findUnique({ where: { id: params.id } });
  if (!post) return Response.json({ message: "Not found" }, { status: 404 });
  // Authors always pass; otherwise require staff moderation permission so a
  // scoped employee (role=ADMIN without content.moderate) cannot read the post.
  if (post.authorId !== user.id) {
    const access = await getAccessControl();
    if (!access || !can(access, "content.moderate")) {
      return forbidden("You can only view your own posts");
    }
  }

  return Response.json(post);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const post = await prisma.studentPost.findUnique({ where: { id: params.id } });
  if (!post) return Response.json({ message: "Not found" }, { status: 404 });
  if (post.authorId !== user.id) return forbidden("You can only edit your own posts");

  // Can only edit drafts or rejected posts
  if (!["draft", "rejected"].includes(post.status)) {
    return Response.json(
      { message: "This post cannot be edited in its current state." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid update data");

  const data = parsed.data;
  const contentChanged = data.content !== undefined;

  const updated = await prisma.studentPost.update({
    where: { id: params.id },
    data: {
      ...(data.type && { type: data.type }),
      ...(data.title && { title: data.title }),
      ...(data.titleDari !== undefined && { titleDari: data.titleDari }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.contentDari !== undefined && { contentDari: data.contentDari }),
      ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
      ...(data.excerptDari !== undefined && { excerptDari: data.excerptDari }),
      ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
      ...(data.galleryUrls !== undefined && {
        galleryUrls: data.galleryUrls ? JSON.stringify(data.galleryUrls) : null,
      }),
      ...(data.language && { language: data.language }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.tags !== undefined && { tags: data.tags?.join(",") || null }),
      ...(data.anonymous !== undefined && { anonymous: data.anonymous }),
      // Re-compute excerpt and read time if content changed
      ...(contentChanged && data.content && !data.excerpt
        ? { excerpt: generateExcerpt(data.content) }
        : {}),
      ...(contentChanged ? { readTimeMin: estimateReadTime(data.content ?? post.content) } : {}),
      // If editing a rejected post, reset to draft so they can resubmit
      ...(post.status === "rejected" ? { status: "draft", reviewNotes: null } : {}),
    },
  });

  return Response.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const post = await prisma.studentPost.findUnique({ where: { id: params.id } });
  if (!post) return Response.json({ message: "Not found" }, { status: 404 });
  // Authors always pass; otherwise require staff moderation permission so a
  // scoped employee (role=ADMIN without content.moderate) cannot delete it.
  if (post.authorId !== user.id) {
    const access = await getAccessControl();
    if (!access || !can(access, "content.moderate")) {
      return forbidden("You can only delete your own posts");
    }
  }

  await prisma.studentPost.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
