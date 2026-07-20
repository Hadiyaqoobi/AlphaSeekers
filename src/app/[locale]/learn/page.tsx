import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { TopicCard } from "@/components/learn/topic-card";
import { TopicSearch } from "@/components/learn/topic-search";
import { SELF_LEARNING_TOPICS } from "@/lib/learn/topics";
import { getSessionUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: PageProps) {
  const isDari = params.locale === "fa";
  return {
    title: isDari ? "خودآموز — آلفاسیکرز" : "Self Learning — AlphaSeekers",
    description: isDari
      ? "هر چیزی را با هوش مصنوعی بیاموزید"
      : "Learn anything with AI-generated lessons",
  };
}

export default async function LearnHomePage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect(`/${params.locale}/login?next=/${params.locale}/learn`);

  const isDari = params.locale === "fa";

  // Fetch in-progress paths
  const inProgress = await prisma.learningPath.findMany({
    where: { userId: user.id, status: "in_progress" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      progress: {
        where: { completed: true },
        select: { lessonNumber: true },
      },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 lg:px-8 py-10" style={{ background: "#070B0E" }}>
      {/* Hero */}
      <div className="mb-10">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
          style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.18)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#00E676", boxShadow: "0 0 8px rgba(0,230,118,0.6)" }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#00E676" }}>
            ✦ {isDari ? "خودآموز" : "Self Learning"}
          </span>
        </div>
        <h1 className="text-3xl sm:text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#FFFFFF" }}>
          {isDari ? "هر چیزی را بیاموزید." : "Learn anything."}
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #00E676 0%, #00E5FF 60%, #2979FF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {isDari ? "با سرعت خودتان." : "At your own pace."}
          </span>
        </h1>
        <p className="mt-4 text-base max-w-xl" style={{ color: "#8AA4B8" }}>
          {isDari
            ? "موضوعی را انتخاب کنید و هوش مصنوعی یک درس شخصی برای شما خواهد ساخت."
            : "Pick a topic and the AI will create a personalized lesson just for you."}
        </p>
      </div>

      {/* Search */}
      <div className="mb-12">
        <TopicSearch isDari={isDari} />
      </div>

      {/* Continue where you left off */}
      {inProgress.length > 0 && (
        <section className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "#8AA4B8" }}>
            ── {isDari ? "ادامه از جایی که متوقف شدید" : "Continue where you left off"} ──
          </h2>
          <div className="space-y-3">
            {inProgress.map((p) => {
              const lessons = (p.lessons as Array<{ title: string }>) || [];
              const totalLessons = lessons.length;
              const completedCount = p.progress.length;
              const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
              const currentLesson = lessons[p.currentLesson - 1];

              return (
                <Link
                  key={p.id}
                  href={`/${params.locale}/learn/${p.id}`}
                  className="group block rounded-2xl p-5 transition-all duration-300"
                  style={{ background: "#0D1419", border: "1px solid #1A2D3D" }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">📗</span>
                        <span className="text-sm font-semibold truncate" style={{ color: "#E8EEF2" }}>
                          {p.title}
                        </span>
                        <span className="text-xs" style={{ color: "#5A7A94" }}>
                          · {isDari ? "درس" : "Lesson"} {p.currentLesson} / {totalLessons}
                        </span>
                      </div>
                      <p className="text-xs mb-3 truncate" style={{ color: "#8AA4B8" }}>
                        {currentLesson?.title || ""}
                      </p>
                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1A2D3D" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: "#00E676",
                            boxShadow: "0 0 6px rgba(0,230,118,0.4)",
                          }}
                        />
                      </div>
                      <p className="text-[10px] mt-1.5" style={{ color: "#5A7A94" }}>
                        {pct}% {isDari ? "تکمیل" : "complete"}
                      </p>
                    </div>
                    <div
                      className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 flex-shrink-0 transition-colors group-hover:bg-[#00E676] group-hover:text-[#070B0E]"
                      style={{ color: "#00E676", border: "1px solid rgba(0,230,118,0.3)" }}
                    >
                      {isDari ? "ادامه" : "Continue"} →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Popular topics grid */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "#8AA4B8" }}>
          {isDari ? "موضوعات محبوب" : "Popular topics"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SELF_LEARNING_TOPICS.map((topic) => (
            <TopicCard key={topic.id} topic={topic} isDari={isDari} />
          ))}
        </div>
      </section>
    </main>
  );
}
