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
  getPublicLandingHighlights,
  getPublicSiteSettings,
  getPublicStory,
} from "@/lib/platform/public-data";
import { updateSiteSettings } from "@/lib/platform/site-settings";

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
});
