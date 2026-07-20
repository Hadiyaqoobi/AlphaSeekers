"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

import type { SelfLearningTopic } from "@/lib/learn/topics";

interface TopicCardProps {
  topic: SelfLearningTopic;
  isDari: boolean;
}

export function TopicCard({ topic, isDari }: TopicCardProps) {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale || "en";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTopic() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/learn/generate-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: isDari ? topic.nameDari : topic.name }),
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
    <button
      type="button"
      onClick={startTopic}
      disabled={loading}
      className="group relative text-left p-5 rounded-2xl transition-all duration-300 disabled:opacity-60 disabled:cursor-wait"
      style={{
        background: "#0D1419",
        border: "1px solid #1A2D3D",
      }}
      onMouseEnter={(e) => {
        if (loading) return;
        e.currentTarget.style.borderColor = "rgba(0,230,118,0.30)";
        e.currentTarget.style.boxShadow = "0 0 20px rgba(0,230,118,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#1A2D3D";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="text-2xl mb-3">{topic.emoji}</div>
      <h3
        className="text-sm font-semibold transition-colors"
        style={{ color: loading ? "#00E676" : "#E8EEF2" }}
      >
        {isDari ? topic.nameDari : topic.name}
      </h3>
      <p className="text-xs mt-1" style={{ color: "#5A7A94" }}>
        {loading ? (isDari ? "در حال ساخت مسیر..." : "Building your path...") : `${topic.suggestedLessons} ${isDari ? "درس" : "lessons"}`}
      </p>
      {error && (
        <p className="text-xs mt-2" style={{ color: "#F87171" }}>{error}</p>
      )}
    </button>
  );
}
