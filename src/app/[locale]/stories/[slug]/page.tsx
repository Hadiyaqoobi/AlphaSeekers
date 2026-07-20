import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PostActions } from "@/components/stories/post-actions";
import { PostCard } from "@/components/stories/post-card";
import { ArtLightbox } from "@/components/stories/art-lightbox";
import { BilingualToggle } from "@/components/stories/bilingual-toggle";
import { renderMarkdown } from "@/lib/stories/markdown";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string; slug: string };
}

const TYPE_LABELS: Record<string, { en: string; fa: string; icon: string }> = {
  article: { en: "Article", fa: "مقاله", icon: "📝" },
  creative_writing: { en: "Story", fa: "داستان", icon: "📖" },
  poetry: { en: "Poetry", fa: "شعر", icon: "✦" },
  art: { en: "Artwork", fa: "هنر", icon: "🎨" },
  spotlight: { en: "Student Spotlight", fa: "معرفی شاگرد", icon: "✨" },
};

export async function generateMetadata({ params }: PageProps) {
  const post = await prisma.studentPost.findUnique({
    where: { slug: params.slug },
    include: { author: { select: { name: true } } },
  });

  if (!post || post.status !== "published") return {};

  const authorName = post.anonymous ? "Anonymous" : post.author.name;
  const title = params.locale === "fa" && post.titleDari ? post.titleDari : post.title;
  const description = post.excerpt || "";

  return {
    title: `${title} — AlphaSeekers Student Voices`,
    description,
    openGraph: {
      title,
      description,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
      type: "article",
      authors: [authorName],
      publishedTime: post.publishedAt?.toISOString(),
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const post = await prisma.studentPost.findUnique({
    where: { slug: params.slug },
    include: { author: { select: { name: true } } },
  });

  if (!post || post.status !== "published") {
    notFound();
  }

  const isDari = params.locale === "fa";
  const typeInfo = TYPE_LABELS[post.type] || TYPE_LABELS.article;
  const authorName = post.anonymous ? "Anonymous" : post.author.name;

  const primaryTitle = isDari && post.titleDari ? post.titleDari : post.title;
  const titleDir = /[\u0600-\u06FF]/.test(primaryTitle) ? "rtl" : "ltr";
  const hasBothLanguages = post.language === "both" && post.contentDari;

  // Render markdown for both languages
  const enHtml = post.content ? renderMarkdown(post.content) : "";
  const daHtml = post.contentDari ? renderMarkdown(post.contentDari) : "";

  // Gallery for art posts
  let galleryImages: string[] = [];
  if (post.galleryUrls) {
    try {
      const parsed = JSON.parse(post.galleryUrls);
      if (Array.isArray(parsed)) galleryImages = parsed.filter((u) => typeof u === "string");
    } catch {
      /* ignore */
    }
  }

  // More posts
  const morePosts = await prisma.studentPost.findMany({
    where: { status: "published", id: { not: post.id } },
    orderBy: { publishedAt: "desc" },
    take: 3,
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
      author: { select: { name: true } },
    },
  });

  const shapedMorePosts = morePosts.map((p) => ({
    ...p,
    author: p.anonymous ? { name: "Anonymous" } : p.author,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  }));

  const siteUrl = process.env.NEXTAUTH_URL || "http://localhost:3005";
  const postUrl = `${siteUrl}/${params.locale}/stories/${post.slug}`;

  return (
    <>
      <article className="bg-[var(--bg-base)] py-12 lg:py-16">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          {/* Meta */}
          <div className="flex items-center justify-between text-sm text-ink-soft mb-6">
            <span className="inline-flex items-center gap-1.5 text-neon-600 font-semibold">
              {typeInfo.icon} {isDari ? typeInfo.fa : typeInfo.en}
            </span>
            {post.publishedAt && (
              <time dateTime={post.publishedAt.toISOString()}>
                {post.publishedAt.toLocaleDateString(isDari ? "fa-AF" : "en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
          </div>

          {/* Title */}
          <h1
            className="text-3xl lg:text-5xl font-bold text-ink-main leading-tight tracking-tight mb-4"
            dir={titleDir}
            style={titleDir === "rtl" ? { fontFamily: "var(--font-dari, Vazirmatn, serif)" } : {}}
          >
            {primaryTitle}
          </h1>

          {/* Byline */}
          <div className="flex items-center gap-4 text-sm text-ink-soft mb-8 pb-8 border-b border-line">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-400 to-teal-600 text-white font-bold flex items-center justify-center">
              {authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-ink-main">{authorName}</p>
              {post.readTimeMin && (
                <p className="text-xs">
                  {post.readTimeMin} {isDari ? "دقیقه مطالعه" : "min read"}
                </p>
              )}
            </div>
          </div>

          {/* Cover image */}
          {post.coverImageUrl && post.type !== "art" && (
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-dark-100 mb-8">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
          )}

          {/* Art gallery */}
          {post.type === "art" && galleryImages.length > 0 && (
            <div className="mb-8">
              <ArtLightbox images={galleryImages} alt={post.title} />
            </div>
          )}
          {post.type === "art" && galleryImages.length === 0 && post.coverImageUrl && (
            <div className="mb-8">
              <ArtLightbox images={[post.coverImageUrl]} alt={post.title} />
            </div>
          )}

          {/* Content */}
          {hasBothLanguages ? (
            <BilingualToggle enContent={enHtml} daContent={daHtml} locale={params.locale} />
          ) : (
            <div
              className={`story-content prose prose-invert max-w-none ${post.type === "poetry" ? "text-center italic" : ""}`}
              dir={titleDir}
              dangerouslySetInnerHTML={{ __html: isDari && daHtml ? daHtml : enHtml }}
            />
          )}

          {/* Actions */}
          <div className="mt-12 pt-8 border-t border-line">
            <PostActions
              slug={post.slug}
              initialLikeCount={post.likeCount}
              title={post.title}
              locale={params.locale}
              postUrl={postUrl}
            />
          </div>
        </div>
      </article>

      {/* More posts */}
      {shapedMorePosts.length > 0 && (
        <section className="bg-dark-50 py-16 border-t border-line">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <h2 className="text-xl font-bold text-ink-main mb-6">
              {isDari ? "داستان‌های بیشتر" : "More from Student Voices"} →
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shapedMorePosts.map((p) => (
                <PostCard key={p.slug} post={p} locale={params.locale} />
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href={`/${params.locale}/stories`}
                className="inline-flex items-center gap-2 text-neon-600 font-semibold hover:text-neon-700"
              >
                {isDari ? "همه داستان‌ها" : "Browse all stories"} →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Story content styles */}
      <style>{`
        .story-content {
          font-size: 1.0625rem;
          line-height: 1.75;
          color: #E8EEF2;
        }
        .story-content .story-heading {
          font-weight: 700;
          color: #FFFFFF;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
        }
        .story-content h2.story-heading { font-size: 1.5rem; }
        .story-content h3.story-heading { font-size: 1.25rem; }
        .story-content h4.story-heading { font-size: 1.125rem; }
        .story-content .story-paragraph {
          margin: 1rem 0;
        }
        .story-content .story-list {
          margin: 1rem 0;
          padding-left: 1.5rem;
          list-style: disc;
        }
        .story-content .story-list.story-ordered {
          list-style: decimal;
        }
        .story-content .story-list-item {
          margin: 0.25rem 0;
        }
        .story-content .story-quote {
          border-left: 3px solid #00E676;
          padding-left: 1rem;
          margin: 1.5rem 0;
          color: #8AA4B8;
          font-style: italic;
        }
        .story-content .story-code {
          background: #0f172a;
          color: #e2e8f0;
          padding: 1rem 1.25rem;
          border-radius: 0.75rem;
          margin: 1.25rem 0;
          overflow-x: auto;
          font-size: 0.875rem;
        }
        .story-content .story-inline-code {
          background: rgba(0, 230, 118, 0.10);
          color: #00E676;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.9em;
        }
        .story-content .story-link {
          color: #00E676;
          text-decoration: underline;
        }
        .story-content[dir="rtl"] {
          font-family: var(--font-dari, Vazirmatn, serif);
        }
        .story-content[dir="rtl"] .story-list {
          padding-left: 0;
          padding-right: 1.5rem;
        }
      `}</style>
    </>
  );
}
