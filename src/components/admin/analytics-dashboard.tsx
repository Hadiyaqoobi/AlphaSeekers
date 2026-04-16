"use client";

import { useEffect, useState } from "react";

type Metrics = {
  summary: {
    totalUsers: number;
    totalStudents: number;
    totalTeachers: number;
    totalAdmins: number;
    totalClasses: number;
    activeClasses: number;
    totalEnrollments: number;
    activeEnrollments: number;
    totalSessions: number;
    totalAIQuestions: number;
    totalMaterials: number;
    totalOpportunities: number;
  };
  growth: {
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    approvalRate: number;
    registrationTrend: { date: string; count: number }[];
  };
  engagement: {
    sessionsThisWeek: number;
    avgClassesPerStudent: string;
    activeStudentsLast7Days: number;
    inactiveStudents14Days: number;
  };
  ai: {
    totalQuestions: number;
    questionsThisWeek: number;
    satisfactionRate: number | null;
    avgResponseMs: number | null;
    modeDistribution: { mode: string; count: number; percentage: number }[];
    cacheStats: { totalCached: number; totalHits: number };
    questionsTrend: { date: string; count: number }[];
    topTopics: { topic: string; count: number }[];
  };
  content: { totalMaterials: number; totalChunks: number; totalOpportunities: number };
  generatedAt: string;
};

const MODE_COLORS: Record<string, string> = {
  study: "#00E676",
  practice: "#00E5FF",
  quiz: "#FFB300",
  explain: "#2979FF",
  vocabulary: "#FF6B9D",
  prepare: "#A78BFA",
  homework_review: "#F87171",
  quick: "#34D07E",
};

const MODE_LABELS: Record<string, string> = {
  study: "Study",
  practice: "Practice",
  quiz: "Quiz",
  explain: "Explain",
  vocabulary: "Vocabulary",
  prepare: "Prep",
  homework_review: "Homework",
  quick: "Quick",
};

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/analytics/metrics")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleCopyMetrics = () => {
    if (!metrics) return;
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const modes = metrics.ai.modeDistribution
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)
      .map((m) => `${m.percentage}% ${MODE_LABELS[m.mode] || m.mode}`)
      .join(", ");
    const text = [
      `AlphaSeekers Platform Metrics (as of ${date})`,
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `Users: ${metrics.summary.totalStudents} students, ${metrics.summary.totalTeachers} teachers`,
      `Classes: ${metrics.summary.activeClasses} active classes (${metrics.summary.totalClasses} total)`,
      `Enrollments: ${metrics.summary.activeEnrollments} active`,
      `Sessions: ${metrics.summary.totalSessions} total sessions held (${metrics.engagement.sessionsThisWeek} this week)`,
      `AI: ${metrics.ai.totalQuestions} questions answered${metrics.ai.satisfactionRate !== null ? `, ${metrics.ai.satisfactionRate}% satisfaction rate` : ""}`,
      modes ? `AI modes: ${modes}` : null,
      `Content: ${metrics.content.totalMaterials} materials uploaded, ${metrics.content.totalChunks} document chunks indexed`,
      `Opportunities posted: ${metrics.content.totalOpportunities}`,
      `Growth: +${metrics.growth.newUsersThisWeek} new users this week, +${metrics.growth.newUsersThisMonth} this month`,
      `Active learners (7d): ${metrics.engagement.activeStudentsLast7Days}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl animate-pulse"
            style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
          />
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div
        className="p-6 rounded-2xl"
        style={{ background: "#0E1921", border: "1px solid #1A2D3D", color: "#F87171" }}
      >
        Failed to load metrics: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ════════ Section 1: Stat cards ════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Students"
          value={metrics.summary.totalStudents}
          trend={metrics.growth.newUsersThisWeek > 0 ? `+${metrics.growth.newUsersThisWeek} this week` : "No new this week"}
          trendPositive={metrics.growth.newUsersThisWeek > 0}
          accentColor="#00E676"
        />
        <StatCard
          label="Teachers"
          value={metrics.summary.totalTeachers}
          trend={`${metrics.summary.totalAdmins} admin(s)`}
          accentColor="#00E5FF"
        />
        <StatCard
          label="Classes"
          value={metrics.summary.totalClasses}
          trend={`${metrics.summary.activeClasses} active`}
          accentColor="#2979FF"
        />
        <StatCard
          label="AI Questions"
          value={metrics.ai.totalQuestions}
          trend={metrics.ai.questionsThisWeek > 0 ? `+${metrics.ai.questionsThisWeek} this week` : "—"}
          trendPositive={metrics.ai.questionsThisWeek > 0}
          accentColor="#FFB300"
        />
        <StatCard
          label="AI Satisfaction"
          value={metrics.ai.satisfactionRate !== null ? `${metrics.ai.satisfactionRate}%` : "—"}
          trend={metrics.ai.avgResponseMs ? `${(metrics.ai.avgResponseMs / 1000).toFixed(1)}s avg` : "Awaiting data"}
          trendPositive={metrics.ai.satisfactionRate !== null && metrics.ai.satisfactionRate >= 70}
          accentColor="#34D07E"
        />
      </div>

      {/* ════════ Section 2 + 3: Growth + AI usage charts ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="User growth"
          subtitle="New registrations per day (last 30 days)"
          data={fillTimeSeries(metrics.growth.registrationTrend, 30)}
          color="#00E676"
        />
        <ChartCard
          title="AI usage"
          subtitle="Questions asked per day (last 30 days)"
          data={fillTimeSeries(metrics.ai.questionsTrend, 30)}
          color="#00E5FF"
        />
      </div>

      {/* ════════ Section 4: Mode distribution + Top topics ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className="rounded-2xl p-6"
          style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
        >
          <h3 className="text-base font-semibold mb-1" style={{ color: "#E8EEF2" }}>
            How students use the AI
          </h3>
          <p className="text-sm mb-5" style={{ color: "#8899A6" }}>
            Mode distribution across all interactions
          </p>
          {metrics.ai.modeDistribution.length === 0 ? (
            <p className="text-sm" style={{ color: "#556677" }}>No AI activity yet</p>
          ) : (
            <div className="space-y-3">
              {metrics.ai.modeDistribution
                .sort((a, b) => b.percentage - a.percentage)
                .map((m) => {
                  const color = MODE_COLORS[m.mode] || "#8899A6";
                  return (
                    <div key={m.mode}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium" style={{ color: "#E8EEF2" }}>
                          {MODE_LABELS[m.mode] || m.mode}
                        </span>
                        <span style={{ color: "#8899A6" }}>
                          {m.count.toLocaleString()} · {m.percentage}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1A2D3D" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${m.percentage}%`,
                            background: color,
                            boxShadow: `0 0 8px ${color}40`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
        >
          <h3 className="text-base font-semibold mb-1" style={{ color: "#E8EEF2" }}>
            Top topics
          </h3>
          <p className="text-sm mb-5" style={{ color: "#8899A6" }}>
            What students asked about most (last 30 days)
          </p>
          {metrics.ai.topTopics.length === 0 ? (
            <p className="text-sm" style={{ color: "#556677" }}>No topic data yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {metrics.ai.topTopics.map((t, i) => {
                const max = metrics.ai.topTopics[0].count;
                const intensity = 0.5 + (t.count / max) * 0.5;
                return (
                  <span
                    key={t.topic}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-xs"
                    style={{
                      background: `rgba(0, 230, 118, ${0.05 + intensity * 0.1})`,
                      border: `1px solid rgba(0, 230, 118, ${0.15 + intensity * 0.15})`,
                      color: "#00E676",
                      fontSize: `${0.7 + (i < 5 ? intensity * 0.3 : 0)}rem`,
                    }}
                  >
                    {t.topic}
                    <span style={{ color: "rgba(0, 230, 118, 0.6)" }}>×{t.count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════ Section 5: Platform health 2-col ════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HealthPanel
          title="Engagement"
          rows={[
            { label: "Active learners (7 days)", value: metrics.engagement.activeStudentsLast7Days, color: "#00E676" },
            { label: "Avg classes per student", value: metrics.engagement.avgClassesPerStudent },
            { label: "Sessions this week", value: metrics.engagement.sessionsThisWeek },
            {
              label: "Inactive students (14+ days)",
              value: metrics.engagement.inactiveStudents14Days,
              color: metrics.engagement.inactiveStudents14Days > 5 ? "#FFB300" : undefined,
            },
            { label: "Approval rate", value: `${metrics.growth.approvalRate}%` },
          ]}
        />
        <HealthPanel
          title="Content & Cache"
          rows={[
            { label: "Materials uploaded", value: metrics.content.totalMaterials },
            { label: "Document chunks indexed", value: metrics.content.totalChunks.toLocaleString() },
            { label: "Opportunities posted", value: metrics.content.totalOpportunities },
            { label: "Cached AI responses", value: metrics.ai.cacheStats.totalCached, color: "#00E5FF" },
            { label: "Total cache hits", value: metrics.ai.cacheStats.totalHits.toLocaleString(), color: "#00E5FF" },
          ]}
        />
      </div>

      {/* ════════ Section 6: Copy metrics for interview ════════ */}
      <div
        className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "#E8EEF2" }}>
            Interview-ready summary
          </p>
          <p className="text-xs mt-1" style={{ color: "#8899A6" }}>
            Generated from real platform data — paste into prep notes or talking points.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyMetrics}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          style={{
            background: copied ? "rgba(0, 230, 118, 0.10)" : "#142230",
            border: `1px solid ${copied ? "#00E676" : "#1E3A4F"}`,
            color: copied ? "#00E676" : "#8899A6",
          }}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Copied to clipboard
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
              📋 Copy platform metrics for interview
            </>
          )}
        </button>
      </div>

      {/* Generated timestamp */}
      <p className="text-xs text-center" style={{ color: "#556677" }}>
        Generated {new Date(metrics.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────
// Stat card
// ───────────────────────────────────────────────
function StatCard({
  label,
  value,
  trend,
  trendPositive,
  accentColor,
}: {
  label: string;
  value: number | string;
  trend?: string;
  trendPositive?: boolean;
  accentColor: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          opacity: 0.6,
        }}
      />
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8899A6" }}>
        {label}
      </p>
      <p className="text-3xl font-bold mt-1" style={{ color: "#E8EEF2" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {trend && (
        <p
          className="text-xs mt-1.5"
          style={{ color: trendPositive ? accentColor : "#556677" }}
        >
          {trend}
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// SVG line chart card (no external deps)
// ───────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  data,
  color,
}: {
  title: string;
  subtitle: string;
  data: { date: string; count: number }[];
  color: string;
}) {
  const width = 600;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 24, left: 28 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const peak = data.reduce((a, b) => (a.count > b.count ? a : b), data[0]);

  // Build line + area paths
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - (d.count / max) * chartH,
    value: d.count,
    date: d.date,
  }));
  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(" ");
  const areaPath = `${linePath} L ${padding.left + (data.length - 1) * stepX},${padding.top + chartH} L ${padding.left},${padding.top + chartH} Z`;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-base font-semibold" style={{ color: "#E8EEF2" }}>
          {title}
        </h3>
        <div className="text-right">
          <p className="text-xs" style={{ color: "#556677" }}>Total / Peak</p>
          <p className="text-sm font-bold" style={{ color }}>
            {total} / {peak?.count ?? 0}
          </p>
        </div>
      </div>
      <p className="text-sm mb-4" style={{ color: "#8899A6" }}>{subtitle}</p>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Gradient defs */}
          <defs>
            <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines (4 horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <line
              key={i}
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + chartH * p}
              y2={padding.top + chartH * p}
              stroke="#1A2D3D"
              strokeDasharray={i === 0 || i === 4 ? "0" : "3 3"}
            />
          ))}
          {/* Y-axis labels */}
          {[1, 0.5, 0].map((p, i) => (
            <text
              key={i}
              x={padding.left - 6}
              y={padding.top + chartH * p + 4}
              textAnchor="end"
              fontSize="10"
              fill="#556677"
            >
              {Math.round(max * (1 - p))}
            </text>
          ))}
          {/* Area */}
          <path d={areaPath} fill={`url(#grad-${color.replace("#", "")})`} />
          {/* Line */}
          <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* Dots — only show at meaningful intervals */}
          {points.map((p, i) => {
            if (data.length > 14 && i % 5 !== 0) return null;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3" fill={color} />
                <circle cx={p.x} cy={p.y} r="6" fill={color} opacity="0.2" />
              </g>
            );
          })}
        </svg>

        {/* X-axis date labels (first/middle/last) */}
        <div className="flex justify-between mt-2 px-7 text-[10px]" style={{ color: "#556677" }}>
          <span>{shortDate(data[0]?.date)}</span>
          <span>{shortDate(data[Math.floor(data.length / 2)]?.date)}</span>
          <span>{shortDate(data[data.length - 1]?.date)}</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// Health panel (key/value list)
// ───────────────────────────────────────────────
function HealthPanel({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number | string; color?: string }[];
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
    >
      <h3 className="text-base font-semibold mb-5" style={{ color: "#E8EEF2" }}>
        {title}
      </h3>
      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between py-2"
            style={{ borderBottom: "1px solid #142230" }}
          >
            <span className="text-sm" style={{ color: "#8899A6" }}>{r.label}</span>
            <span className="text-sm font-bold" style={{ color: r.color || "#E8EEF2" }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────
function fillTimeSeries(raw: { date: string; count: number }[], days: number) {
  const byDate = new Map(raw.map((d) => [d.date, d.count]));
  const out: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return out;
}

function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
