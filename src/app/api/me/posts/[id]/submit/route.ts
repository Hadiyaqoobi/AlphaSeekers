/**
 * POST /api/me/posts/[id]/submit
 *
 * Submit a draft (or previously rejected) post for review.
 * Sets status: draft → pending_review.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized, forbidden } from "@/lib/security/session";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const post = await prisma.studentPost.findUnique({ where: { id: params.id } });
  if (!post) return Response.json({ message: "Not found" }, { status: 404 });
  if (post.authorId !== user.id) return forbidden("You can only submit your own posts");

  if (!["draft", "rejected"].includes(post.status)) {
    return Response.json(
      { message: "This post cannot be submitted in its current state." },
      { status: 409 },
    );
  }

  // Basic validation: must have a title and content (or gallery for art)
  const hasContent = Boolean(post.content && post.content.trim().length > 20);
  const hasGallery =
    post.type === "art" &&
    post.galleryUrls &&
    JSON.parse(post.galleryUrls).length > 0;
  const hasCoverImage = Boolean(post.coverImageUrl);

  if (!hasContent && !hasGallery && !hasCoverImage) {
    return Response.json(
      { message: "Post needs content or an image before it can be submitted." },
      { status: 400 },
    );
  }

  const updated = await prisma.studentPost.update({
    where: { id: params.id },
    data: {
      status: "pending_review",
      reviewNotes: null, // Clear any previous rejection note
    },
  });

  return Response.json(updated);
}
