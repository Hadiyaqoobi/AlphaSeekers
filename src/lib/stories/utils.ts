/**
 * Shared utilities for Student Voices (posts).
 */

import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["article", "creative_writing", "poetry", "art", "spotlight"] as const;
export type PostType = (typeof VALID_TYPES)[number];

export function isValidPostType(t: unknown): t is PostType {
  return typeof t === "string" && VALID_TYPES.includes(t as PostType);
}

/**
 * Generate a URL-friendly slug from a title.
 * "My Journey Learning English!" → "my-journey-learning-english"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // strip punctuation
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80) || "untitled";
}

/**
 * Generate a unique slug, appending -2, -3, etc. if the base slug exists.
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;

  while (await prisma.studentPost.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

/**
 * Estimate read time in minutes.
 * Assumes 200 words per minute (average reading speed).
 */
export function estimateReadTime(content: string | null | undefined): number {
  if (!content) return 1;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Auto-generate excerpt from content (first 200 chars, broken at word boundary).
 */
export function generateExcerpt(content: string | null | undefined): string {
  if (!content) return "";
  const plain = content
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/[#*_`]/g, "") // Strip markdown
    .replace(/\n+/g, " ")
    .trim();

  if (plain.length <= 200) return plain;

  // Break at word boundary
  const truncated = plain.substring(0, 200);
  const lastSpace = truncated.lastIndexOf(" ");
  return truncated.substring(0, lastSpace > 150 ? lastSpace : 200) + "...";
}
