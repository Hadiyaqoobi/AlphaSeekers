/**
 * Unit tests for the Student Voices slug utilities (src/lib/stories/utils.ts).
 *
 * The Wave-1 fix made slugify Unicode-aware so Persian/Dari and mixed-script
 * titles produce meaningful slugs instead of collapsing to a constant fallback
 * ("untitled"). generateUniqueSlug then resolves collisions. utils.ts imports
 * `@/lib/prisma` at module load, so we mock it and drive findMany per-test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// utils.ts imports the real prisma client at module scope; stub it.
// `vi.hoisted` runs before the hoisted vi.mock factory so the fn is initialized.
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { studentPost: { findMany } },
}));

import { slugify, generateUniqueSlug } from "@/lib/stories/utils";

describe("slugify — ASCII titles", () => {
  it("produces a lowercase hyphenated slug and drops punctuation", () => {
    expect(slugify("My Journey Learning English!")).toBe("my-journey-learning-english");
  });

  it("collapses runs of whitespace to single hyphens", () => {
    expect(slugify("a   b\t c")).toBe("a-b-c");
  });

  it("trims leading/trailing whitespace and stray hyphens", () => {
    expect(slugify("  --Hello World--  ")).toBe("hello-world");
  });

  it("keeps digits", () => {
    expect(slugify("Top 10 Tips")).toBe("top-10-tips");
  });
});

describe("slugify — Persian/Dari and mixed-script titles", () => {
  it("preserves Persian letters instead of collapsing to a constant fallback", () => {
    const slug = slugify("سفر من");
    expect(slug).toBe("سفر-من");
    // Meaningful: not the deterministic hash fallback used for un-sluggable input.
    expect(slug.startsWith("post-")).toBe(false);
    expect(slug.length).toBeGreaterThan(0);
  });

  it("handles a longer Dari phrase, whitespace becoming hyphens", () => {
    const slug = slugify("داستان زندگی من");
    expect(slug).toBe("داستان-زندگی-من");
    expect(slug).not.toContain(" ");
  });

  it("preserves both scripts in a mixed English/Persian title", () => {
    const slug = slugify("Hello سلام World");
    expect(slug).toBe("hello-سلام-world");
    expect(slug.startsWith("post-")).toBe(false);
  });

  it("distinct Persian titles yield distinct, non-empty slugs", () => {
    const a = slugify("امید");
    const b = slugify("آینده");
    expect(a).not.toBe("");
    expect(b).not.toBe("");
    expect(a).not.toBe(b);
    expect(a.startsWith("post-")).toBe(false);
    expect(b.startsWith("post-")).toBe(false);
  });
});

describe("slugify — un-sluggable input falls back deterministically", () => {
  it("returns a stable post-<hash> id (never empty) when no letters/numbers remain", () => {
    const a = slugify("!!!???");
    const b = slugify("!!!???");
    expect(a).toMatch(/^post-[0-9a-f]{8}$/);
    expect(a).toBe(b); // deterministic
  });

  it("different un-sluggable inputs get different fallback ids", () => {
    expect(slugify("###")).not.toBe(slugify("@@@@"));
  });
});

describe("generateUniqueSlug — collision resolution", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("returns the base slug when nothing conflicts", async () => {
    findMany.mockResolvedValue([]);
    await expect(generateUniqueSlug("My Post")).resolves.toBe("my-post");
  });

  it("appends -2 when the base slug is already taken", async () => {
    findMany.mockResolvedValue([{ slug: "my-post" }]);
    await expect(generateUniqueSlug("My Post")).resolves.toBe("my-post-2");
  });

  it("skips consecutively taken suffixes to the first free one", async () => {
    findMany.mockResolvedValue([
      { slug: "my-post" },
      { slug: "my-post-2" },
      { slug: "my-post-3" },
    ]);
    await expect(generateUniqueSlug("My Post")).resolves.toBe("my-post-4");
  });

  it("queries by the base slug prefix (single round-trip)", async () => {
    findMany.mockResolvedValue([]);
    await generateUniqueSlug("My Post");
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { slug: { startsWith: "my-post" } },
      select: { slug: true },
    });
  });

  it("produces unique Persian slugs across collisions", async () => {
    findMany.mockResolvedValue([{ slug: "سفر-من" }]);
    await expect(generateUniqueSlug("سفر من")).resolves.toBe("سفر-من-2");
  });
});
