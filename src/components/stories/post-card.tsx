import Link from "next/link";

export type PostCardData = {
  slug: string;
  type: string;
  title: string;
  titleDari?: string | null;
  excerpt?: string | null;
  excerptDari?: string | null;
  coverImageUrl?: string | null;
  galleryUrls?: string | null;
  language?: string;
  readTimeMin?: number | null;
  likeCount?: number;
  anonymous?: boolean;
  author?: { name: string } | null;
  publishedAt?: string | Date | null;
};

interface PostCardProps {
  post: PostCardData;
  locale: string;
}

const TYPE_LABELS: Record<string, string> = {
  article: "Article",
  creative_writing: "Story",
  poetry: "Poetry",
  art: "Artwork",
  spotlight: "Spotlight",
};

const TYPE_ICONS: Record<string, string> = {
  article: "M5.25 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5V5.25M5.25 5.25A2.25 2.25 0 0 1 7.5 3h9a2.25 2.25 0 0 1 2.25 2.25M9 12h6m-6 3h6m-6-6h3",
  creative_writing: "M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931z",
  poetry: "M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25",
  art: "M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0z",
  spotlight: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z",
};

export function PostCard({ post, locale }: PostCardProps) {
  const isDari = locale === "fa";
  const isArabic = /[\u0600-\u06FF]/.test(post.title);
  const title = isDari && post.titleDari ? post.titleDari : post.title;
  const excerpt = isDari && post.excerptDari ? post.excerptDari : post.excerpt;
  const titleDir = isDari || isArabic ? "rtl" : "ltr";
  const authorName = post.anonymous ? "Anonymous" : post.author?.name || "Student";

  // Poetry card variant
  if (post.type === "poetry") {
    return (
      <Link
        href={`/${locale}/stories/${post.slug}`}
        className="group block rounded-2xl bg-gradient-to-br from-amber-50 via-white to-rose-50 border border-amber-100 p-8 text-center hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
      >
        <div className="text-amber-500 text-2xl mb-4">✦</div>
        {excerpt && (
          <p
            className="text-ink-main italic text-[15px] leading-relaxed line-clamp-5 mb-4"
            dir={titleDir}
            style={isDari ? { fontFamily: "var(--font-dari, Vazirmatn, serif)" } : {}}
          >
            &ldquo;{excerpt}&rdquo;
          </p>
        )}
        <p
          className="text-sm font-semibold text-amber-800 mt-4"
          dir={titleDir}
        >
          {title}
        </p>
        <p className="text-xs text-ink-soft mt-1">— {authorName}</p>
      </Link>
    );
  }

  // Art card variant (image-dominant)
  if (post.type === "art") {
    return (
      <Link
        href={`/${locale}/stories/${post.slug}`}
        className="group block rounded-2xl overflow-hidden border border-line bg-dark-100 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
      >
        <div className="relative aspect-[4/5] bg-dark-100 overflow-hidden">
          {post.coverImageUrl ? (
            // Plain <img> for user-uploaded R2 images: Next's image optimizer has
            // no remotePatterns entry for the R2 host (would throw) and is known
            // to 504 on these on Render.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImageUrl}
              alt={post.title}
              width={800}
              height={1000}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-100 to-rose-100">
              <svg className="w-16 h-16 text-violet-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICONS.art} />
              </svg>
            </div>
          )}
        </div>
        <div className="p-4">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 mb-1">
            🎨 {TYPE_LABELS.art}
          </span>
          <h3 className="font-bold text-ink-main leading-snug line-clamp-2" dir={titleDir}>
            {title}
          </h3>
          <p className="text-xs text-ink-soft mt-1.5">
            {authorName} · ♡ {post.likeCount ?? 0}
          </p>
        </div>
      </Link>
    );
  }

  // Spotlight card variant
  if (post.type === "spotlight") {
    const initial = authorName.charAt(0).toUpperCase();
    return (
      <Link
        href={`/${locale}/stories/${post.slug}`}
        className="group block rounded-2xl border border-line bg-dark-100 p-6 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-neon-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {post.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.coverImageUrl}
                alt={authorName}
                width={48}
                height={48}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-neon-600">
              ✨ {TYPE_LABELS.spotlight}
            </span>
            <p className="font-bold text-ink-main truncate">Meet {authorName}</p>
          </div>
        </div>
        {excerpt && (
          <p className="text-sm text-ink-soft italic line-clamp-4 leading-relaxed" dir={titleDir}>
            &ldquo;{excerpt}&rdquo;
          </p>
        )}
      </Link>
    );
  }

  // Default: article / creative_writing
  return (
    <Link
      href={`/${locale}/stories/${post.slug}`}
      className="group block rounded-2xl overflow-hidden border border-line bg-dark-100 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="relative aspect-[16/9] bg-dark-100 overflow-hidden">
        {post.coverImageUrl ? (
          // Plain <img> for user-uploaded R2 images: Next's image optimizer has
          // no remotePatterns entry for the R2 host (would throw) and is known
          // to 504 on these on Render.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImageUrl}
            alt={post.title}
            width={1280}
            height={720}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neon-100 via-teal-50 to-sky-100">
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-neon-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICONS[post.type] || TYPE_ICONS.article} />
              </svg>
            </div>
          </div>
        )}
      </div>
      <div className="p-5">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-neon-600 mb-2">
          📝 {TYPE_LABELS[post.type] || "Post"}
        </span>
        <h3
          className="font-bold text-ink-main leading-snug line-clamp-2 text-lg"
          dir={titleDir}
        >
          {title}
        </h3>
        {excerpt && (
          <p
            className="text-sm text-ink-soft mt-2 line-clamp-3 leading-relaxed"
            dir={titleDir}
          >
            {excerpt}
          </p>
        )}
        <p className="text-xs text-ink-faint mt-3">
          {authorName}
          {post.readTimeMin ? ` · ${post.readTimeMin} min read` : ""}
          {post.likeCount ? ` · ♡ ${post.likeCount}` : ""}
        </p>
      </div>
    </Link>
  );
}
