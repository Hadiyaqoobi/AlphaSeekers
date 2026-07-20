"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { PostCard, type PostCardData } from "./post-card";

type FilterType = "all" | "article" | "poetry" | "art" | "spotlight" | "dari";

interface StoriesBrowseProps {
  locale: string;
  initialPosts: PostCardData[];
  featuredPosts: PostCardData[];
}

export function StoriesBrowse({ locale, initialPosts, featuredPosts }: StoriesBrowseProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [posts, setPosts] = useState<PostCardData[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const isDari = locale === "fa";

  useEffect(() => {
    if (filter === "all") {
      setPosts(initialPosts);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    if (filter === "dari") {
      params.set("language", "da");
    } else if (filter === "article") {
      params.set("type", "article");
    } else {
      params.set("type", filter);
    }

    fetch(`/api/posts?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter, initialPosts]);

  const filterTabs: { value: FilterType; label: string }[] = [
    { value: "all", label: isDari ? "همه" : "All" },
    { value: "article", label: isDari ? "مقاله" : "Articles" },
    { value: "poetry", label: isDari ? "شعر" : "Poetry" },
    { value: "art", label: isDari ? "هنر" : "Art" },
    { value: "spotlight", label: isDari ? "معرفی" : "Spotlights" },
    { value: "dari", label: "دری" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative bg-land-dark overflow-hidden">
        <div
          className="absolute blur-[120px] rounded-full opacity-20"
          style={{
            width: 400,
            height: 400,
            top: "40%",
            left: "60%",
            background: "radial-gradient(circle, rgba(29,185,100,0.12) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-20 lg:py-28 text-center">
          <p className="text-land-green-400 text-sm font-semibold uppercase tracking-[0.15em] mb-4">
            {isDari ? "صداهای شاگردان" : "Student Voices"}
          </p>
          <h1
            className="text-4xl lg:text-5xl font-bold text-white tracking-tight"
            style={{ fontFamily: "var(--font-landing), var(--font-display-latin), sans-serif" }}
          >
            {isDari ? "داستان‌های واقعی از شاگردان افغان" : "Real stories from Afghan students"}
          </h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto mt-6 leading-relaxed">
            {isDari
              ? "سفر یادگیری، رشد و رؤیاپردازی."
              : "Their journey of learning, growing, and dreaming."}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/${locale}/stories/write`}
              className="inline-flex items-center px-6 py-3 rounded-xl bg-dark-100 text-land-green-700 font-bold hover:-translate-y-0.5 hover:shadow-xl transition-all"
            >
              {isDari ? "داستان خود را بنویسید" : "Write your story"} →
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featuredPosts.length > 0 && (
        <section className="bg-[var(--bg-base)] py-16">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neon-600 mb-4">
              {isDari ? "داستان برگزیده" : "Featured"}
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {featuredPosts.map((post) => (
                <FeaturedPostHero key={post.slug} post={post} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Filter + Grid */}
      <section className="bg-[var(--bg-base)] pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto mb-8 border-b border-line">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors relative ${
                  filter === tab.value
                    ? "text-neon-700"
                    : "text-ink-soft hover:text-ink-main"
                }`}
              >
                {tab.label}
                {filter === tab.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-600" />
                )}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-80 rounded-2xl bg-dark-100 animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-ink-faint">
                {isDari ? "هیچ پستی پیدا نشد." : "No stories found in this category."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function FeaturedPostHero({ post, locale }: { post: PostCardData; locale: string }) {
  const isDari = locale === "fa";
  const title = isDari && post.titleDari ? post.titleDari : post.title;
  const excerpt = isDari && post.excerptDari ? post.excerptDari : post.excerpt;
  const authorName = post.anonymous ? "Anonymous" : post.author?.name || "Student";

  return (
    <Link
      href={`/${locale}/stories/${post.slug}`}
      className="group block rounded-2xl overflow-hidden border border-line bg-dark-100 hover:shadow-lg transition-all"
    >
      <div className="relative aspect-[21/10] bg-dark-100 overflow-hidden">
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neon-600 to-teal-700" />
        )}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center gap-1 bg-dark-100/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-neon-700">
            ⭐ {isDari ? "برگزیده" : "Featured"}
          </span>
        </div>
      </div>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-ink-main leading-tight group-hover:text-neon-700 transition-colors">
          {title}
        </h2>
        {excerpt && (
          <p className="text-ink-soft mt-3 line-clamp-2 leading-relaxed">{excerpt}</p>
        )}
        <p className="text-sm text-ink-faint mt-4">
          {authorName}
          {post.readTimeMin ? ` · ${post.readTimeMin} min read` : ""}
        </p>
      </div>
    </Link>
  );
}
