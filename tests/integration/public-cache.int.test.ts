/**
 * Integration tests for the public-page cache against a REAL Postgres.
 *
 * The unit tests cover the cache's own rules. These cover the part that only
 * exists once Prisma is involved: that a write made anywhere through the shared
 * client invalidates what the public pages have cached, with no call site having
 * to ask. If that hook ever stops firing, an admin saves a change and the public
 * site silently keeps showing the old one — the exact class of bug this team has
 * reported before.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { refreshPublicCache, resetPublicCacheForTests } from "@/lib/platform/public-cache";
import {
  getPublicJoinClass,
  getPublicLandingHighlights,
  getPublicOpportunities,
  getPublicSiteSettings,
  getPublicStory,
} from "@/lib/platform/public-data";
import { updateSiteSettings } from "@/lib/platform/site-settings";
import {
  flushStoryViews,
  pendingStoryViewCount,
  recordStoryView,
  resetStoryViewsForTests,
} from "@/lib/platform/story-views";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "pubcache";
const email = (s: string) => `${TAG}+${s}@example.com`;

const MINUTE = 60 * 1000;

/** Step past the settle window that follows every write, so a load is trusted. */
function settle() {
  vi.setSystemTime(Date.now() + 5_000);
}

async function cleanup() {
  await prisma.siteSettings.deleteMany({ where: { id: "default" } });
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${TAG}+` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.studentPost.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeUser(slug: string, role: "TEACHER" | "STUDENT") {
  return prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role, approvedAt: new Date() },
    select: { id: true },
  });
}

d("public-page cache + Prisma (real Postgres)", () => {
  beforeEach(async () => {
    // Only Date is faked: the queries below are real I/O and need real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    delete process.env.PUBLIC_CACHE_TTL_SECONDS;
    await cleanup();
    resetPublicCacheForTests();
    resetStoryViewsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("shows an admin's saved setting on the very next public read", async () => {
    expect((await getPublicSiteSettings()).instagramUrl).toBeNull();

    await updateSiteSettings({ instagramUrl: "https://instagram.com/alphaseekers" }, "tester");

    expect((await getPublicSiteSettings()).instagramUrl).toBe(
      "https://instagram.com/alphaseekers",
    );
  });

  // A change made with raw SQL is invisible to the hook. This is what proves the
  // reads really are served from memory, and that the hourly refresh is what
  // picks such a change up.
  it("serves from memory until refreshed when the database changes behind its back", async () => {
    await updateSiteSettings({ contactEmail: "first@example.com" }, "tester");
    settle();
    expect((await getPublicSiteSettings()).contactEmail).toBe("first@example.com");

    await prisma.$executeRaw`UPDATE "SiteSettings" SET "contactEmail" = 'second@example.com' WHERE id = 'default'`;

    expect((await getPublicSiteSettings()).contactEmail).toBe("first@example.com");

    expect(await refreshPublicCache()).toMatchObject({ failed: 0 });
    expect((await getPublicSiteSettings()).contactEmail).toBe("second@example.com");
  });

  it("puts a newly created class on the landing page without waiting for a refresh", async () => {
    const teacher = await makeUser("teacher", "TEACHER");
    settle();
    const before = await getPublicLandingHighlights();
    expect(before.classes.some((c) => c.name === `${TAG} algebra`)).toBe(false);

    await prisma.class.create({
      data: {
        name: `${TAG} algebra`,
        subjectCategory: "Math",
        description: "fixture",
        teacherId: teacher.id,
        maxStudents: 30,
        status: "ACTIVE",
        published: true,
      },
    });

    const after = await getPublicLandingHighlights();
    expect(after.classes.some((c) => c.name === `${TAG} algebra`)).toBe(true);
  });

  it("drops a class the moment its registration closes, even from a cached list", async () => {
    const teacher = await makeUser("deadline-teacher", "TEACHER");
    await prisma.class.create({
      data: {
        name: `${TAG} closing soon`,
        subjectCategory: "English",
        description: "fixture",
        teacherId: teacher.id,
        maxStudents: 30,
        status: "ACTIVE",
        published: true,
        registrationDeadline: new Date(Date.now() + 30 * MINUTE),
      },
    });
    settle();

    const open = await getPublicLandingHighlights();
    expect(open.classes.some((c) => c.name === `${TAG} closing soon`)).toBe(true);

    // Well inside the cache TTL, so this read comes from memory.
    vi.setSystemTime(Date.now() + 45 * MINUTE);

    const closed = await getPublicLandingHighlights();
    expect(closed.classes.some((c) => c.name === `${TAG} closing soon`)).toBe(false);
  });

  it("stops serving a story as soon as it is unpublished", async () => {
    const author = await makeUser("author", "STUDENT");
    const slug = `${TAG}-my-story`;
    const post = await prisma.studentPost.create({
      data: {
        authorId: author.id,
        type: "article",
        title: `${TAG} my story`,
        slug,
        content: "hello",
        status: "published",
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    settle();

    expect((await getPublicStory(slug))?.post.title).toBe(`${TAG} my story`);

    await prisma.studentPost.update({ where: { id: post.id }, data: { status: "archived" } });

    expect(await getPublicStory(slug)).toBeNull();
  });

  async function makePost(slug: string, status: "published" | "draft") {
    const author = await makeUser(`author-${slug}`, "STUDENT");
    return prisma.studentPost.create({
      data: {
        authorId: author.id,
        type: "article",
        title: `${TAG} ${slug}`,
        slug,
        content: "hello",
        status,
        publishedAt: status === "published" ? new Date() : null,
      },
      select: { id: true },
    });
  }

  // A like (or a flushed view) is not a content change. If it invalidated the
  // whole "stories" scope, every like would make the next stranger wake Neon.
  it("keeps cached stories through a like-count update, but not through an edit", async () => {
    const slug = `${TAG}-liked`;
    const post = await makePost(slug, "published");
    settle();
    expect((await getPublicStory(slug))?.post.title).toBe(`${TAG} ${slug}`);

    // Changed behind the cache's back, to see whether the next read reloads.
    await prisma.$executeRaw`UPDATE "StudentPost" SET "title" = 'renamed' WHERE "id" = ${post.id}`;
    await prisma.studentPost.update({ where: { id: post.id }, data: { likeCount: { increment: 1 } } });

    expect((await getPublicStory(slug))?.post.title).toBe(`${TAG} ${slug}`);

    await prisma.studentPost.update({ where: { id: post.id }, data: { excerpt: "edited" } });
    expect((await getPublicStory(slug))?.post.title).toBe("renamed");
  });

  it("caches a missing story, and shows it as soon as it is published", async () => {
    const slug = `${TAG}-later`;
    const post = await makePost(slug, "draft");
    settle();

    expect(await getPublicStory(slug)).toBeNull();

    // Published behind the cache's back: the cached miss is still served,
    // which is what proves the miss was cached at all.
    await prisma.$executeRaw`UPDATE "StudentPost" SET "status" = 'published', "publishedAt" = now() WHERE "id" = ${post.id}`;
    expect(await getPublicStory(slug)).toBeNull();

    // Published through the app: a StudentPost write, so the scope is invalidated.
    await prisma.studentPost.update({ where: { id: post.id }, data: { status: "published" } });
    expect((await getPublicStory(slug))?.post.title).toBe(`${TAG} ${slug}`);
  });

  it("buffers story views in memory and writes them in one go, without evicting the page", async () => {
    const slug = `${TAG}-viewed`;
    const post = await makePost(slug, "published");
    settle();
    await getPublicStory(slug);

    recordStoryView(slug);
    recordStoryView(slug);
    recordStoryView(slug);
    recordStoryView(`${TAG}-no-such-story`);
    expect(pendingStoryViewCount()).toBe(4);

    const before = await prisma.studentPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(before.viewCount).toBe(0);

    await prisma.$executeRaw`UPDATE "StudentPost" SET "title" = 'renamed' WHERE "id" = ${post.id}`;
    expect(await flushStoryViews()).toEqual({ written: 4, failed: 0 });
    expect(pendingStoryViewCount()).toBe(0);

    const after = await prisma.studentPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(after.viewCount).toBe(3);
    // The flush did not invalidate the cached page.
    expect((await getPublicStory(slug))?.post.title).toBe(`${TAG} ${slug}`);
  });

  it("serves the join page from memory and keeps seatsLeft right when someone joins", async () => {
    const teacher = await makeUser("join-teacher", "TEACHER");
    const student = await makeUser("join-student", "STUDENT");
    const klass = await prisma.class.create({
      data: {
        name: `${TAG} joinable`,
        subjectCategory: "English",
        description: "fixture",
        teacherId: teacher.id,
        maxStudents: 5,
        status: "ACTIVE",
        published: true,
      },
      select: { id: true },
    });
    settle();

    expect(await getPublicJoinClass(klass.id)).toMatchObject({ name: `${TAG} joinable`, seatsLeft: 5 });

    await prisma.$executeRaw`UPDATE "Class" SET "name" = 'renamed' WHERE "id" = ${klass.id}`;
    expect((await getPublicJoinClass(klass.id))?.name).toBe(`${TAG} joinable`);

    await prisma.enrollment.create({
      data: { classId: klass.id, studentId: student.id, status: "ACTIVE" },
    });
    expect(await getPublicJoinClass(klass.id)).toMatchObject({ name: "renamed", seatsLeft: 4 });
  });

  it("answers an impossible class id without a cache entry, and a missing one with a cached null", async () => {
    expect(await getPublicJoinClass("../../etc/passwd")).toBeNull();
    expect(await getPublicJoinClass(`${TAG}missingclass`)).toBeNull();
  });

  it("treats an unknown opportunity filter as no filter instead of failing", async () => {
    const all = await getPublicOpportunities(undefined);
    expect(await getPublicOpportunities("NOT_A_TYPE")).toEqual(all);
  });
});
