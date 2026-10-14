/**
 * Cached readers for the pages a signed-out visitor can open.
 *
 * Each function here is the cached twin of a loader that already exists. Public
 * pages call these; admin pages, API routes and tests keep calling the loaders
 * directly and always see the database. See `public-cache.ts` for why the cache
 * exists and how it is kept correct.
 */
import { prisma } from "@/lib/prisma";
import { getPublicClassForJoin, type PublicClassSummary } from "@/lib/platform/class-join";
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
 * `type` comes from the URL. An unknown value is treated as no filter at all,
 * so it is served from the "ALL" entry: a crawler cannot fill the cache with
 * made-up keys, and a typo'd link shows the list instead of an error (passing
 * an unknown value to the enum filter made Prisma throw).
 *
 * `expired` is worked out again on every read. The loader computes it at load
 * time, and entries now live up to a day (26h TTL), so the cached flag alone
 * could show a closed opportunity as open for most of that day.
 */
export async function getPublicOpportunities(type?: string) {
  const filter = type !== undefined && OPPORTUNITY_TYPES.has(type) ? type : undefined;
  const cached = await readThroughPublicCache("opportunities", filter ?? "ALL", () =>
    listOpportunities(filter),
  );

  const now = Date.now();
  return cached
    .map((item) => ({ ...item, expired: Date.parse(item.deadline) < now }))
    .sort((a, b) => {
      // Same order as the loader: open ones first, each group by deadline.
      if (a.expired !== b.expired) return a.expired ? 1 : -1;
      return Date.parse(a.deadline) - Date.parse(b.deadline);
    });
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
 * A miss ("no such story") is cached too, or every request for an old or
 * mistyped link would wake the database. That is safe because any write to
 * `StudentPost` invalidates the whole "stories" scope (`src/lib/prisma.ts`):
 * a story published a moment ago replaces its cached miss, and one just
 * unpublished replaces its cached page with a miss. URL-derived keys are
 * bounded by the cache's entry cap.
 */
export async function getPublicStory(slug: string) {
  return readThroughPublicCache("stories", `post:${slug}`, () => loadStory(slug));
}

/** A class id as the app generates them (cuid) or the seed data names them. */
const CLASS_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The public join page's class summary, or null.
 *
 * The join page is linked from the landing page, so every crawler follows it,
 * and its link is what gets pasted into WhatsApp (whose previewer ignores
 * robots.txt). Each of those used to wake the database.
 *
 * Cached in the "landing" scope because writes to `Class` and `Enrollment`
 * already invalidate that scope: a class that is edited, unpublished or gains a
 * student is re-read, so `seatsLeft` stays right. A null ("no such public
 * class") is cached as well; publishing the class is a `Class` write, which
 * replaces it. An id that could not be a class id is answered without a query
 * and without a cache entry.
 */
export async function getPublicJoinClass(classId: string): Promise<PublicClassSummary | null> {
  if (!CLASS_ID_PATTERN.test(classId)) return null;
  return readThroughPublicCache("landing", `join:${classId}`, () => getPublicClassForJoin(classId));
}
