"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

export function TopicSearch({ isDari }: { isDari: boolean }) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale || "en";
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCustomTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/learn/generate-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Generation failed (${res.status})`);
      }
      const data = await res.json();
      router.push(`/${locale}/learn/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={startCustomTopic} className="relative">
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        disabled={loading}
        placeholder={
          isDari
            ? "چه می‌خواهید بیاموزید؟ (مثلاً: «اصول پایتون»)"
            : "What do you want to learn? (e.g., 'Python basics', 'How electricity works', 'Resume writing')"
        }
        className="w-full px-5 py-4 pr-40 rounded-2xl text-sm transition-colors focus:outline-none"
        style={{
          background: "#0D1419",
          border: "1px solid #1A2D3D",
          color: "#E8EEF2",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#00E676";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,230,118,0.15)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#1A2D3D";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button
        type="submit"
        disabled={loading || !topic.trim()}
        className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ background: "#00E676", color: "#070B0E", boxShadow: "0 0 12px rgba(0,230,118,0.3)" }}
      >
        {loading
          ? (isDari ? "در حال ساخت..." : "Building...")
          : (isDari ? "شروع یادگیری ←" : "Start learning →")}
      </button>
      {error && <p className="absolute top-full mt-2 text-xs" style={{ color: "#F87171" }}>{error}</p>}
    </form>
  );
}
