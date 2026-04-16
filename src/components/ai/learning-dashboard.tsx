"use client";

import { useEffect, useState } from "react";

type LearningStats = {
  dailyActivity: { date: string; count: number }[];
  modeDistribution: { mode: string; count: number }[];
  topTopics: { topic: string; count: number }[];
  vocabularyLearned: number;
  vocabDueToday: number;
  totalQuestions: number;
  streak: number;
  questionsThisWeek: number;
  questionsLastWeek: number;
  weekChange: number | null;
  period: string;
};

const MODE_COLORS: Record<string, string> = {
  study: "#059669",
  practice: "#2563eb",
  quiz: "#d97706",
  explain: "#7c3aed",
  vocabulary: "#e11d48",
  prepare: "#0284c7",
  homework_review: "#db2777",
};

const MODE_LABELS: Record<string, string> = {
  study: "Study",
  practice: "Practice",
  quiz: "Quiz",
  explain: "Explain",
  vocabulary: "Vocabulary",
  prepare: "Prep",
  homework_review: "Homework",
};

export function LearningDashboard() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/learning-stats")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-dark-100 rounded-2xl border border-line-DEFAULT p-6 h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return <p className="text-ink-soft">Unable to load stats right now.</p>;
  }

  if (stats.totalQuestions === 0) {
    return (
      <div className="bg-dark-100 rounded-2xl border border-line-DEFAULT p-12 text-center">
        <h3 className="text-xl font-bold text-ink-main mb-2">No activity yet</h3>
        <p className="text-ink-soft">Start asking the AI Tutor questions and your stats will appear here.</p>
      </div>
    );
  }

  // Prepare daily activity for chart — last 30 days, fill gaps with 0
  const chartData = buildChartData(stats.dailyActivity);
  const maxCount = Math.max(...chartData.map((d) => d.count), 1);
  const totalByMode = stats.modeDistribution.reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="space-y-6">
      {/* Top stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total questions"
          value={stats.totalQuestions.toString()}
          subtitle={stats.weekChange !== null
            ? `${stats.weekChange > 0 ? "↑" : stats.weekChange < 0 ? "↓" : "→"} ${Math.abs(stats.weekChange)}% this week`
            : "Keep going!"}
        />
        <StatCard
          label="Study streak"
          value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`}
          subtitle={stats.streak > 0 ? "🔥 Keep it up!" : "Start today"}
        />
        <StatCard
          label="Vocabulary learned"
          value={stats.vocabularyLearned.toString()}
          subtitle={stats.vocabDueToday > 0 ? `${stats.vocabDueToday} due today` : "Nothing due"}
        />
        <StatCard
          label="This week"
          value={stats.questionsThisWeek.toString()}
          subtitle={`vs ${stats.questionsLastWeek} last week`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily activity chart */}
        <div className="lg:col-span-2 bg-dark-100 rounded-2xl border border-line-DEFAULT p-6">
          <h3 className="text-base font-bold text-ink-main mb-4">Daily activity (30 days)</h3>
          <div className="flex items-end gap-1 h-40">
            {chartData.map((d, i) => (
              <div
                key={i}
                className="flex-1 bg-neon-500 rounded-sm hover:bg-neon-600 transition-colors relative group"
                style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                title={`${d.date}: ${d.count} question${d.count === 1 ? "" : "s"}`}
              >
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-DEFAULT text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {d.count} on {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-ink-faint">
            <span>{chartData[0]?.date.slice(5)}</span>
            <span>{chartData[chartData.length - 1]?.date.slice(5)}</span>
          </div>
        </div>

        {/* Mode distribution */}
        <div className="bg-dark-100 rounded-2xl border border-line-DEFAULT p-6">
          <h3 className="text-base font-bold text-ink-main mb-4">How you study</h3>
          {stats.modeDistribution.length === 0 ? (
            <p className="text-sm text-ink-faint">No data yet</p>
          ) : (
            <div className="space-y-2">
              {stats.modeDistribution
                .sort((a, b) => b.count - a.count)
                .map((m) => {
                  const pct = Math.round((m.count / totalByMode) * 100);
                  return (
                    <div key={m.mode}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-ink-main">
                          {MODE_LABELS[m.mode] || m.mode}
                        </span>
                        <span className="text-ink-faint">{pct}%</span>
                      </div>
                      <div className="h-2 bg-dark-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: MODE_COLORS[m.mode] || "#64748b" }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Top topics */}
      <div className="bg-dark-100 rounded-2xl border border-line-DEFAULT p-6">
        <h3 className="text-base font-bold text-ink-main mb-4">Topics you&apos;ve studied</h3>
        {stats.topTopics.length === 0 ? (
          <p className="text-sm text-ink-faint">No topics tracked yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.topTopics.map((t) => {
              const maxTopic = stats.topTopics[0].count;
              const size = t.count / maxTopic;
              return (
                <span
                  key={t.topic}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-50 text-neon-700 font-medium"
                  style={{
                    fontSize: `${0.75 + size * 0.4}rem`,
                    opacity: 0.5 + size * 0.5,
                  }}
                >
                  {t.topic}
                  <span className="text-neon-500 text-xs">×{t.count}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-dark-100 rounded-2xl border border-line-DEFAULT p-5">
      <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-ink-main mt-1">{value}</p>
      {subtitle && <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>}
    </div>
  );
}

/**
 * Build chart data: last 30 days, filling gaps with 0.
 */
function buildChartData(raw: { date: string; count: number }[]): { date: string; count: number }[] {
  const byDate = new Map(raw.map((d) => [d.date, d.count]));
  const result: { date: string; count: number }[] = [];

  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    result.push({ date: key, count: byDate.get(key) ?? 0 });
  }

  return result;
}
