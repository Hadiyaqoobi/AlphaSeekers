/**
 * Cached readers for the pages a signed-out visitor can open.
 *
 * Each function here is the cached twin of a loader that already exists. Public
 * pages call these; admin pages, API routes and tests keep calling the loaders
 * directly and always see the database. See `public-cache.ts` for why the cache
 * exists and how it is kept correct.
 */
import { prisma } from "@/lib/prisma";
import {
  EMPTY_HIGHLIGHTS,
  loadLandingHighlights,
  type LandingHighlights,
} from "@/lib/platform/landing-highlights";
import { readThroughPublicCache } from "@/lib/platform/public-cache";
import {
  EMPTY_SITE_SETTINGS,
  loadSiteSettings,
  type SiteSettings,
} from "@/lib/platform/site-settings";
import { listLibraryResources, listOpportunities, listWebinars } from "@/lib/platform/store";

/** Footer and contact-page details. Empty, and not cached, if they cannot be loaded. */
export async function getPublicSiteSettings(): Promise<SiteSettings> {
  try {
    return await readThroughPublicCache("settings", "default", loadSiteSettings);
  } catch {
    return EMPTY_SITE_SETTINGS;
  }
}

/**
 * The landing page's "open now" section.
 *
 * The cached set is whatever was open when it was loaded. Things only ever LEAVE
 * that set as time passes (a deadline goes by, a webinar starts), so they are
 * filtered out again on every read: a class still drops off the front page the
 * moment its registration closes, not at the next refresh.
 */
export async function getPublicLandingHighlights(): Promise<LandingHighlights> {
  let cached: LandingHighlights;
  try {
    cached = await readThroughPublicCache("landing", "highlights", loadLandingHighlights);
  } catch {
    return EMPTY_HIGHLIGHTS;
  }

  const now = Date.now();
  return {
    classes: cached.classes.filter(
      (c) => c.registrationDeadline === null || Date.parse(c.registrationDeadline) >= now,
    ),
    webinars: cached.webinars.filter((w) => Date.parse(w.startsAt) >= now),
    opportunities: cached.opportunities.filter((o) => Date.parse(o.deadline) >= now),
  };
}

/** The whole library. A search always goes to the database: its key space is unbounded. */
export async function getPublicLibrary(query: string) {
  if (query.trim() !== "") return listLibraryResources(query);
  return readThroughPublicCache("library", "all", () => listLibraryResources(""));
}

export async function getPublicWebinars() {
  return readThroughPublicCache("webinars", "all", () => listWebinars());
}

const OPPORTUNITY_TYPES = new Set(["SCHOLARSHIP", "JOB", "INTERNSHIP", "GRANT"]);

/**
 * `type` comes from the URL. Only the known filters are cached; anything else is
 * passed through so a crawler cannot fill the cache with made-up keys.
 */
export async function getPublicOpportunities(type?: string) {
  if (type !== undefined && !OPPORTUNITY_TYPES.has(type)) return listOpportunities(type);
  return readThroughPublicCache("opportunities", type ?? "ALL", () => listOpportunities(type));
}

const POST_CARD_SELECT = {
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
} as const;

async function loadStoriesIndex() {
  const publishedCount = await prisma.studentPost.count({
    where: { status: "published" },
  });

  if (publishedCount === 0) {
    return { publishedCount, posts: [], featuredPosts: [] };
  }

  const [posts, featuredPosts] = await Promise.all([
    prisma.studentPost.findMany({
      where: { status: "published" },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: 24,
      select: { ...POST_CARD_SELECT, galleryUrls: true, featured: true },
    }),
    prisma.studentPost.findMany({
      where: { status: "published", featured: true },
      orderBy: { publishedAt: "desc" },
      take: 2,
      select: POST_CARD_SELECT,
    }),
  ]);

  return { publishedCount, posts, featuredPosts };
}

/** Everything the Student Voices index needs, in one cached entry. */
export async function getPublicStoriesIndex() {
  return readThroughPublicCache("stories", "index", loadStoriesIndex);
}

async function loadStory(slug: string) {
  const post = await prisma.studentPost.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });

  if (!post || post.status !== "published") return null;

  const morePosts = await prisma.studentPost.findMany({
    where: { status: "published", id: { not: post.id } },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { ...POST_CARD_SELECT, galleryUrls: true },
  });

  return { post, morePosts };
}

/**
 * One published story plus the "more stories" strip under it, or null.
 *
 * A miss is never cached: slugs come from the URL, and a story that has just
 * been unpublished must stop being served rather than linger as a stale entry.
 */
export async function getPublicStory(slug: string) {
  return readThroughPublicCache("stories", `post:${slug}`, () => loadStory(slug), {
    shouldCache: (story) => story !== null,
  });
}
