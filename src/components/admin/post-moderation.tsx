"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AdminPost = {
  id: string;
  slug: string;
  type: string;
  title: string;
  content: string | null;
  coverImageUrl: string | null;
  galleryUrls: string | null;
  status: string;
  featured: boolean;
  readTimeMin: number | null;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  reviewNotes: string | null;
  author: { id: string; name: string; email: string };
};

const TYPE_LABELS: Record<string, string> = {
  article: "📝 Article",
  creative_writing: "📖 Story",
  poetry: "✦ Poetry",
  art: "🎨 Artwork",
  spotlight: "✨ Spotlight",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-dark-100 text-ink-soft",
  pending_review: "bg-amber-500/10 text-amber-300",
  published: "bg-neon-500/10 text-neon-300",
  rejected: "bg-red-500/10 text-red-300",
  archived: "bg-dark-200 text-ink-soft",
};

export function PostModeration({ locale }: { locale: string }) {
  const [filter, setFilter] = useState<"pending_review" | "published" | "rejected" | "all">("pending_review");
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<AdminPost | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    const url = filter === "pending_review"
      ? "/api/admin/posts/pending"
      : `/api/admin/posts?status=${filter}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleApprove = useCallback(async (id: string) => {
    setProcessing(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/posts/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Approve failed");
      }
      fetchPosts();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(null);
    }
  }, [fetchPosts]);

  const handleReject = useCallback(async (id: string) => {
    if (!rejectNotes.trim()) {
      setError("Please provide feedback for the student");
      return;
    }
    setProcessing(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/posts/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", notes: rejectNotes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Reject failed");
      }
      setRejecting(null);
      setRejectNotes("");
      fetchPosts();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(null);
    }
  }, [rejectNotes, fetchPosts]);

  const handleToggleFeatured = useCallback(async (post: AdminPost) => {
    setProcessing(post.id);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}/feature`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !post.featured }),
      });
      if (!res.ok) throw new Error("Feature toggle failed");
      fetchPosts();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(null);
    }
  }, [fetchPosts]);

  const tabs: { value: typeof filter; label: string }[] = [
    { value: "pending_review", label: "Pending review" },
    { value: "published", label: "Published" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
  ];

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b border-line overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-3 text-sm font-medium relative whitespace-nowrap shrink-0 ${
              filter === tab.value ? "text-neon-400" : "text-ink-soft hover:text-ink-main"
            }`}
          >
            {tab.label}
            {filter === tab.value && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-500" />}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">{error}</div>
      )}

      {/* Moderation guidelines */}
      <details className="mb-6 rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-blue-200">
          Moderation guidelines
        </summary>
        <ul className="mt-3 text-sm text-blue-300 space-y-1 list-disc pl-5">
          <li>Is the content appropriate for all ages?</li>
          <li>Does it contain personal information the student might not want public?</li>
          <li>Is it genuine student content (not copied from the internet)?</li>
          <li>Does artwork belong to the student?</li>
          <li>If in Dari: is it readable and appropriate?</li>
        </ul>
      </details>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-dark-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-center text-ink-faint py-12">No posts in this view.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="rounded-xl bg-dark-100 border border-line p-4">
              <div className="flex items-start gap-4">
                {post.coverImageUrl && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-dark-100 flex-shrink-0">
                    <Image src={post.coverImageUrl} alt="" fill className="object-cover" sizes="80px" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-medium text-ink-soft">{TYPE_LABELS[post.type] || post.type}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[post.status]}`}>
                      {post.status.replace("_", " ")}
                    </span>
                    {post.featured && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">
                        ⭐ Featured
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-ink-main truncate">{post.title}</h3>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {post.author.name} · {post.author.email}
                    {post.publishedAt && ` · Published ${new Date(post.publishedAt).toLocaleDateString()}`}
                    {!post.publishedAt && ` · Updated ${new Date(post.updatedAt).toLocaleDateString()}`}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                  <button
                    onClick={() => setSelectedPost(post)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-soft bg-dark-100 hover:bg-dark-200"
                  >
                    Preview
                  </button>
                  {post.status === "pending_review" && (
                    <>
                      <button
                        onClick={() => handleApprove(post.id)}
                        disabled={processing === post.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-neon-600 hover:bg-neon-500 disabled:opacity-50"
                      >
                        {processing === post.id ? "..." : "Approve ✓"}
                      </button>
                      <button
                        onClick={() => setRejecting(post.id)}
                        disabled={processing === post.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Reject ✗
                      </button>
                    </>
                  )}
                  {post.status === "published" && (
                    <button
                      onClick={() => handleToggleFeatured(post)}
                      disabled={processing === post.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        post.featured ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25" : "bg-dark-100 text-ink-main hover:bg-dark-200"
                      } disabled:opacity-50`}
                    >
                      {post.featured ? "★ Unfeature" : "☆ Feature"}
                    </button>
                  )}
                  <Link
                    href={`/${locale}/stories/${post.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-soft hover:bg-dark-100 inline-flex items-center"
                  >
                    View →
                  </Link>
                </div>
              </div>

              {/* Reject form */}
              {rejecting === post.id && (
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="text-xs font-semibold text-ink-main mb-2">
                    Feedback for the student (required)
                  </p>
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Explain why this post needs changes. Be kind and specific."
                    rows={3}
                    className="w-full rounded-lg bg-dark-200 border border-white/10 px-3 py-2 text-sm text-ink-main placeholder-ink-faint focus:border-neon-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleReject(post.id)}
                      disabled={!rejectNotes.trim() || processing === post.id}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-red-300 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-50"
                    >
                      Send rejection
                    </button>
                    <button
                      onClick={() => {
                        setRejecting(null);
                        setRejectNotes("");
                      }}
                      className="px-4 py-2 rounded-lg text-sm text-ink-soft hover:bg-dark-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {post.reviewNotes && post.status === "rejected" && (
                <div className="mt-3 pt-3 border-t border-line text-xs text-ink-soft">
                  <span className="font-semibold">Previous feedback:</span> {post.reviewNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="bg-dark-100 rounded-2xl shadow-2xl max-w-2xl w-full p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink-main">Preview</h3>
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="text-ink-faint hover:text-ink-soft"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <span className="text-xs font-semibold text-neon-400">{TYPE_LABELS[selectedPost.type]}</span>
            <h2 className="text-2xl font-bold text-ink-main mt-2 mb-2">{selectedPost.title}</h2>
            <p className="text-sm text-ink-soft mb-4">
              By {selectedPost.author.name}
              {selectedPost.readTimeMin && ` · ${selectedPost.readTimeMin} min read`}
            </p>
            {selectedPost.coverImageUrl && (
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-dark-100 mb-4">
                <Image src={selectedPost.coverImageUrl} alt="" fill className="object-cover" sizes="100vw" />
              </div>
            )}
            <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap">
              {selectedPost.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
