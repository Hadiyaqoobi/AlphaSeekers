"use client";

import { useCallback, useEffect, useState } from "react";

interface PostActionsProps {
  slug: string;
  initialLikeCount: number;
  title: string;
  locale: string;
  postUrl: string;
}

export function PostActions({ slug, initialLikeCount, title, locale, postUrl }: PostActionsProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDari = locale === "fa";

  // Fire view counter on mount (once)
  useEffect(() => {
    fetch(`/api/posts/${slug}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);

  const handleLike = useCallback(async () => {
    if (liking) return;
    setLiking(true);
    setError(null);

    try {
      const res = await fetch(`/api/posts/${slug}/like`, { method: "POST" });
      if (res.status === 401) {
        setError(isDari ? "برای لایک کردن وارد شوید" : "Please log in to like this post");
        setLiking(false);
        return;
      }
      if (!res.ok) throw new Error("Request failed");

      const data = await res.json();
      setLiked(data.liked);
      setLikeCount((c) => (data.liked ? c + 1 : Math.max(0, c - 1)));
    } catch {
      setError(isDari ? "عمل ممکن نشد" : "Action failed");
    } finally {
      setLiking(false);
    }
  }, [liking, slug, isDari]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy link");
    }
  }, [postUrl]);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} — ${postUrl}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(postUrl)}`;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={handleLike}
        disabled={liking}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
          liked
            ? "bg-rose-50 text-rose-600 border border-rose-200"
            : "bg-dark-50 text-ink-soft hover:bg-rose-50 hover:text-rose-600 border border-line-DEFAULT"
        }`}
      >
        <svg className="w-4 h-4" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
        {likeCount} {isDari ? "لایک" : "likes"}
      </button>

      <button
        type="button"
        onClick={handleCopyLink}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-dark-50 text-ink-soft hover:bg-dark-100 border border-line-DEFAULT transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        {copied ? (isDari ? "کپی شد!" : "Copied!") : isDari ? "کپی لینک" : "Copy link"}
      </button>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-dark-50 text-ink-soft hover:bg-green-50 hover:text-green-700 border border-line-DEFAULT transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
        WhatsApp
      </a>

      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-dark-50 text-ink-soft hover:bg-sky-50 hover:text-sky-700 border border-line-DEFAULT transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        X/Twitter
      </a>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
