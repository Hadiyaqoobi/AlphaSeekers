/**
 * POST /api/posts/[slug]/view
 *
 * Public, fire-and-forget — increment the view count for a post.
 */

import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: { slug: string } }) {
  try {
    await prisma.studentPost.update({
      where: { slug: params.slug },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Silent fail — this is non-critical
  }
  return Response.json({ ok: true });
}
