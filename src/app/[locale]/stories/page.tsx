import { prisma } from "@/lib/prisma";
import { StoriesBrowse } from "@/components/stories/stories-browse";
import { StoriesComingSoon } from "@/components/stories/stories-coming-soon";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: PageProps) {
  const isDari = params.locale === "fa";
  return {
    title: isDari ? "صداهای شاگردان — آلفاسیکرز" : "Student Voices — AlphaSeekers",
    description: isDari
      ? "داستان‌های واقعی از شاگردان افغان در سفر یادگیری."
      : "Real stories from Afghan students on their journey of learning.",
  };
}

export default async function StoriesPage({ params }: PageProps) {
  const publishedCount = await prisma.studentPost.count({
    where: { status: "published" },
  });

  if (publishedCount === 0) {
    return <StoriesComingSoon locale={params.locale} />;
  }

  const [posts, featuredPosts] = await Promise.all([
    prisma.studentPost.findMany({
      where: { status: "published" },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: 24,
      select: {
        id: true,
        slug: true,
        type: true,
        title: true,
        titleDari: true,
        excerpt: true,
        excerptDari: true,
        coverImageUrl: true,
        galleryUrls: true,
        language: true,
        readTimeMin: true,
        anonymous: true,
        likeCount: true,
        publishedAt: true,
        featured: true,
        author: { select: { name: true } },
      },
    }),
    prisma.studentPost.findMany({
      where: { status: "published", featured: true },
      orderBy: { publishedAt: "desc" },
      take: 2,
      select: {
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
      },
    }),
  ]);

  const shapedPosts = posts.map((p) => ({
    ...p,
    author: p.anonymous ? { name: "Anonymous" } : p.author,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  }));

  const shapedFeatured = featuredPosts.map((p) => ({
    ...p,
    author: p.anonymous ? { name: "Anonymous" } : p.author,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  }));

  // Filter out featured posts from the main grid to avoid duplicates
  const nonFeatured = shapedPosts.filter((p) => !p.featured);

  return (
    <StoriesBrowse
      locale={params.locale}
      initialPosts={nonFeatured}
      featuredPosts={shapedFeatured}
    />
  );
}
