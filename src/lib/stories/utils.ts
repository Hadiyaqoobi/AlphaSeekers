/**
 * Shared utilities for Student Voices (posts).
 */

import { createHash } from "crypto";

import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["article", "creative_writing", "poetry", "art", "spotlight"] as const;
export type PostType = (typeof VALID_TYPES)[number];

export function isValidPostType(t: unknown): t is PostType {
  return typeof t === "string" && VALID_TYPES.includes(t as PostType);
}

/**
 * Short, stable fallback id derived from the input, used when a title contains
 * no sluggable characters at all. Deterministic so the same title maps to the
 * same base (collisions are still resolved by generateUniqueSlug).
 */
function fallbackSlug(input: string): string {
  const hash = createHash("sha1").update(input, "utf8").digest("hex").slice(0, 8);
  return `post-${hash}`;
}

/**
 * Generate a URL-friendly slug from a title.
 * "My Journey Learning English!" → "my-journey-learning-english"
 *
 * Unicode-aware: letters/numbers in any script (Persian/Dari, Arabic, etc.)
 * are preserved instead of being stripped to "untitled". Only punctuation and
 * symbols are removed; whitespace collapses to hyphens.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    // Keep Unicode letters/numbers, whitespace and hyphens; drop everything else.
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80)
    // A hard length cut can leave a trailing hyphen; trim it again.
    .replace(/-+$/g, "");

  return slug || fallbackSlug(input);
}

/**
 * Generate a unique slug, appending -2, -3, etc. if the base slug exists.
 *
 * Resolves uniqueness in a SINGLE query: fetch every existing slug that shares
 * the base prefix, then pick the first free suffix in memory instead of issuing
 * one DB round-trip per candidate.
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);

  const existing = await prisma.studentPost.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map((row) => row.slug));

  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
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
