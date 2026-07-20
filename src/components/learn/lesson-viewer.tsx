"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LessonChat } from "./lesson-chat";
import { SectionRenderer, type LessonSection } from "./lesson-sections";

interface LessonViewerProps {
  pathId: string;
  lessonNumber: number;
  locale: string;
  pathTitle: string;
}

type LessonData = {
  sections: LessonSection[];
  pathTitle: string;
  lessonTitle: string;
  totalLessons: number;
};

export function LessonViewer({ pathId, lessonNumber, locale, pathTitle }: LessonViewerProps) {
  const router = useRouter();
  const isDari = locale === "fa";
  const [data, setData] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setQuizScore(null);
    fetch("/api/learn/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathId, lessonNumber }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          throw new Error(body?.message || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: LessonData) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [pathId, lessonNumber]);

  // Mark complete on summary "next" click
  async function handleSummaryNext() {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      await fetch("/api/learn/lesson/check-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathId,
          lessonNumber,
          prompt: "lesson-completion",
          answer: "completed",
          quizScore: quizScore ?? 1,
          markComplete: true,
        }),
      });
      router.refresh();
    } catch {
      // silent — user already advanced
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 lg:px-8 py-10" style={{ background: "#070B0E" }}>
        <div className="space-y-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl animate-pulse"
              style={{ background: "#0D1419", border: "1px solid #1A2D3D" }}
            />
          ))}
          <p className="text-center text-sm" style={{ color: "#8AA4B8" }}>
            {isDari ? "در حال ساخت درس شما..." : "Building your lesson..."}
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center" style={{ background: "#070B0E" }}>
        <h1 className="text-xl font-bold mb-3" style={{ color: "#FFFFFF" }}>
          {isDari ? "نمی‌توان درس را بارگیری کرد" : "Couldn't load this lesson"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "#8AA4B8" }}>{error || "Unknown error"}</p>
        <Link
          href={`/${locale}/learn/${pathId}`}
          className="inline-block px-5 py-2.5 rounded-xl font-semibold"
          style={{ background: "#00E676", color: "#070B0E" }}
        >
          ← {isDari ? "بازگشت" : "Back to path"}
        </Link>
      </main>
    );
  }

  const isLastLesson = lessonNumber >= data.totalLessons;
  const nextHref = isLastLesson
    ? `/${locale}/learn/${pathId}`
    : `/${locale}/learn/${pathId}/${lessonNumber + 1}`;
  const progressPct = Math.round((lessonNumber / data.totalLessons) * 100);

  return (
    <main className="mx-auto max-w-4xl px-6 lg:px-8 py-8" style={{ background: "#070B0E" }}>
      {/* Top bar with progress */}
      <div
        className="rounded-xl px-5 py-3 mb-6 flex items-center justify-between gap-4"
        style={{ background: "#0D1419", border: "1px solid #1A2D3D" }}
      >
        <Link
          href={`/${locale}/learn/${pathId}`}
          className="text-xs font-medium flex items-center gap-1 transition-colors"
          style={{ color: "#8AA4B8" }}
        >
          ← {isDari ? "مسیر" : "Path"}
        </Link>
        <div className="flex-1 mx-4 min-w-0">
          <p className="text-xs truncate text-center" style={{ color: "#8AA4B8" }}>
            {pathTitle}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs" style={{ color: "#5A7A94" }}>
            {isDari ? "درس" : "Lesson"} {lessonNumber} / {data.totalLessons}
          </span>
          <div className="w-20 h-1.5 rounded-full overflow-hidden hidden sm:block" style={{ background: "#1A2D3D" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #00E676, #00E5FF)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Lesson title */}
      <h1 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: "#FFFFFF" }}>
        {data.lessonTitle}
      </h1>
      <div
        className="h-px mb-8"
        style={{ background: "linear-gradient(90deg, #00E676, transparent)" }}
      />

      {/* Sections */}
      <div className="space-y-6">
        {data.sections.map((section, i) => (
          <SectionRenderer
            key={i}
            section={section}
            pathId={pathId}
            lessonNumber={lessonNumber}
            onQuizComplete={(score) => setQuizScore(score)}
            onSummaryNext={handleSummaryNext}
            isLastLesson={isLastLesson}
            nextHref={nextHref}
          />
        ))}
      </div>

      {/* Lesson chat at bottom */}
      <div className="mt-8">
        <LessonChat pathId={pathId} lessonNumber={lessonNumber} isDari={isDari} />
      </div>
    </main>
  );
}
