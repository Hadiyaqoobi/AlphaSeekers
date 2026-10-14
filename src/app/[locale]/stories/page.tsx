import { getPublicStoriesIndex } from "@/lib/platform/public-data";
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
  // From the public-page cache: this index is linked from the landing page, so
  // crawlers reach it, and it must not wake the database for each of them.
  const { publishedCount, posts, featuredPosts } = await getPublicStoriesIndex();

  if (publishedCount === 0) {
    return <StoriesComingSoon locale={params.locale} />;
  }

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
