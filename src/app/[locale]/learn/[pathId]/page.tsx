import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string; pathId: string };
}

type LessonOutline = {
  number: number;
  title: string;
  description?: string;
  difficulty?: string;
};

export default async function LearningPathPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect(`/${params.locale}/login?next=/${params.locale}/learn/${params.pathId}`);

  const path = await prisma.learningPath.findUnique({
    where: { id: params.pathId },
    include: { progress: true },
  });

  if (!path || path.userId !== user.id) notFound();

  const isDari = params.locale === "fa";
  const lessons = (path.lessons as LessonOutline[]) || [];
  const progressMap = new Map(path.progress.map((p) => [p.lessonNumber, p]));
  const completedCount = path.progress.filter((p) => p.completed).length;
  const totalLessons = lessons.length;
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return (
    <main className="mx-auto max-w-4xl px-6 lg:px-8 py-10" style={{ background: "#070B0E" }}>
      {/* Back link */}
      <Link
        href={`/${params.locale}/learn`}
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors"
        style={{ color: "#8AA4B8" }}
      >
        ← {isDari ? "همه مسیرها" : "All paths"}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: "#FFFFFF" }}>
          {path.title}
        </h1>
        {path.description && (
          <p className="mt-3 text-base" style={{ color: "#8AA4B8" }}>
            {path.description}
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span style={{ color: "#8AA4B8" }}>
              {completedCount} {isDari ? "از" : "of"} {totalLessons} {isDari ? "درس انجام شده" : "lessons done"}
            </span>
            <span style={{ color: "#00E676", fontWeight: 600 }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1A2D3D" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, #00E676, #00E5FF)",
                boxShadow: "0 0 10px rgba(0,230,118,0.5)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Lesson list */}
      <div className="space-y-3">
        {lessons.map((lesson) => {
          const lessonNum = lesson.number || lessons.indexOf(lesson) + 1;
          const progress = progressMap.get(lessonNum);
          const isDone = progress?.completed === true;
          const isCurrent = lessonNum === path.currentLesson;
          const isLocked = lessonNum > path.currentLesson;

          let statusBadge: string;
          let badgeColor: string;
          let badgeBg: string;
          if (isDone) {
            statusBadge = isDari ? "✅ انجام شده" : "✅ Done";
            badgeColor = "#00E676";
            badgeBg = "rgba(0,230,118,0.10)";
          } else if (isCurrent) {
            statusBadge = isDari ? "🔵 فعلی" : "🔵 Current";
            badgeColor = "#00E5FF";
            badgeBg = "rgba(0,229,255,0.10)";
          } else {
            statusBadge = isDari ? "⬚ قفل" : "⬚ Locked";
            badgeColor = "#5A7A94";
            badgeBg = "transparent";
          }

          const card = (
            <div
              className={`rounded-2xl p-5 transition-all ${isLocked ? "opacity-60" : ""}`}
              style={{
                background: isCurrent ? "rgba(0,229,255,0.04)" : "#0D1419",
                border: `1px solid ${isCurrent ? "rgba(0,229,255,0.30)" : "#1A2D3D"}`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                      style={{
                        background: isDone ? "#00E676" : isCurrent ? "rgba(0,229,255,0.15)" : "#142230",
                        color: isDone ? "#070B0E" : isCurrent ? "#00E5FF" : "#5A7A94",
                        border: isCurrent ? "1px solid rgba(0,229,255,0.4)" : "none",
                      }}
                    >
                      {lessonNum}
                    </span>
                    <h3 className="text-base font-semibold" style={{ color: isLocked ? "#5A7A94" : "#E8EEF2" }}>
                      {isDari ? "درس" : "Lesson"} {lessonNum}: {lesson.title}
                    </h3>
                  </div>
                  {lesson.description && (
                    <p className="text-sm ml-9 mb-2" style={{ color: "#8AA4B8" }}>
                      {lesson.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 ml-9 text-xs" style={{ color: "#5A7A94" }}>
                    {isDone && progress?.quizScore !== null && progress?.quizScore !== undefined && (
                      <span>
                        {isDari ? "نمره" : "Score"}:{" "}
                        <span style={{ color: "#00E676" }}>
                          {Math.round(progress.quizScore * 3)}/3
                        </span>
                      </span>
                    )}
                    {isLocked && (
                      <span>
                        {isDari ? "درس" : "Complete lesson"} {lessonNum - 1} {isDari ? "را تکمیل کنید" : "to unlock"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded"
                    style={{ background: badgeBg, color: badgeColor }}
                  >
                    {statusBadge}
                  </span>
                  {!isLocked && (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isCurrent ? "#00E5FF" : "#00E676" }}
                    >
                      {isDone
                        ? isDari ? "مرور" : "Review"
                        : isDari ? "ادامه" : "Continue"} →
                    </span>
                  )}
                </div>
              </div>
            </div>
          );

          if (isLocked) {
            return (
              <div key={lessonNum} className="cursor-not-allowed">
                {card}
              </div>
            );
          }

          return (
            <Link
              key={lessonNum}
              href={`/${params.locale}/learn/${params.pathId}/${lessonNum}`}
              className="block hover:scale-[1.005] transition-transform"
            >
              {card}
            </Link>
          );
        })}
      </div>

      {/* Path completion celebration */}
      {path.status === "completed" && (
        <div
          className="mt-8 rounded-2xl p-8 text-center"
          style={{
            background: "linear-gradient(180deg, rgba(0,230,118,0.10), transparent)",
            border: "1px solid rgba(0,230,118,0.30)",
          }}
        >
          <div className="text-4xl mb-3">🎓</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#FFFFFF" }}>
            {isDari ? "تبریک — مسیر را تکمیل کردید!" : "Congratulations — path complete!"}
          </h2>
          <p className="text-sm mb-4" style={{ color: "#8AA4B8" }}>
            {isDari ? "موضوع جدیدی را یاد بگیرید." : "Ready to learn something else?"}
          </p>
          <Link
            href={`/${params.locale}/learn`}
            className="inline-block px-5 py-2.5 rounded-xl font-semibold"
            style={{ background: "#00E676", color: "#070B0E" }}
          >
            {isDari ? "موضوع جدید" : "Pick a new topic"} →
          </Link>
        </div>
      )}
    </main>
  );
}
