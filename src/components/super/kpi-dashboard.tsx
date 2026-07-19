/**
 * Platform-wide KPI overview for super admins. Server component: receives the
 * already-aggregated SuperKpis plus the 24h audit-event count (filled by the
 * page). Covers four areas — Students, Classes, AI, Ops — each with clear
 * headings and lightweight inline-SVG / CSS visualizations.
 */

import type { ReactNode } from "react";

import type { SuperKpis } from "@/lib/platform/super-store";

import { BarChart, Meter, Sparkline } from "./charts";
import { StatCard } from "./stat-card";

const NEON = "#00C853";
const CYAN = "#00B8D4";
const BLUE = "#2962FF";
const AMBER = "#FFA000";
const RED = "#DC2626";

const nf = (n: number) => n.toLocaleString();
/** Percentage from a 0..1 ratio, 0–1 decimal places. */
const pf = (ratio: number) => `${Number((Math.max(0, Math.min(1, ratio)) * 100).toFixed(1))}%`;

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-600">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      {(title || subtitle) && <div className="mt-4" />}
      {children}
    </div>
  );
}

const NOTIF_STATUS_META: { key: string; label: string; color: string }[] = [
  { key: "SENT", label: "Sent", color: NEON },
  { key: "FAILED", label: "Failed", color: RED },
  { key: "PENDING", label: "Pending", color: AMBER },
];

export function KpiDashboard({
  kpis,
  auditEvents24h,
}: {
  kpis: SuperKpis;
  auditEvents24h: number;
}) {
  const { students, classes, ai, ops } = kpis;

  // Notification breakdown: known statuses first (with zeros), then any extras.
  const notifMap = new Map(ops.notifications.map((n) => [n.status, n.count]));
  const knownKeys = new Set(NOTIF_STATUS_META.map((m) => m.key));
  const notifRows = [
    ...NOTIF_STATUS_META.map((m) => ({ ...m, count: notifMap.get(m.key) ?? 0 })),
    ...ops.notifications
      .filter((n) => !knownKeys.has(n.status))
      .map((n) => ({ key: n.status, label: n.status, color: "#6B7280", count: n.count })),
  ];
  const notifTotal = notifRows.reduce((s, r) => s + r.count, 0);

  const providerData = ai.byProvider.map((p) => ({ label: p.provider, value: p.count }));

  return (
    <div className="space-y-10">
      {/* ─── Students & enrollment ─────────────────────────────────── */}
      <Section
        eyebrow="Students"
        title="Students & enrollment"
        description="Learner growth and active course enrollments across the platform."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total students" value={students.total} accent={NEON} />
          <StatCard
            label="Pending approval"
            value={students.pendingApproval}
            hint={students.pendingApproval > 0 ? "Awaiting review" : "All caught up"}
            accent={students.pendingApproval > 0 ? AMBER : NEON}
          />
          <StatCard label="New (7 days)" value={students.new7d} accent={CYAN} />
          <StatCard label="New (30 days)" value={students.new30d} accent={CYAN} />
          <StatCard
            label="Active enrollments"
            value={students.activeEnrollments}
            hint={`+${nf(students.enrollments7d)} in 7 days`}
            accent={BLUE}
          />
        </div>
        <Panel
          title="Signups — last 14 days"
          subtitle={`${nf(students.signupTrend.reduce((s, d) => s + d.count, 0))} new students in the window`}
        >
          <Sparkline points={students.signupTrend} color={NEON} height={64} label="Student signups per day, last 14 days" />
          <div className="mt-2 flex justify-between text-[11px] text-gray-400">
            <span>{formatDay(students.signupTrend[0]?.day)}</span>
            <span>{formatDay(students.signupTrend[students.signupTrend.length - 1]?.day)}</span>
          </div>
        </Panel>
      </Section>

      {/* ─── Classes & attendance ──────────────────────────────────── */}
      <Section
        eyebrow="Classes"
        title="Classes & attendance"
        description="Teaching capacity, upcoming sessions and how full and engaged classes are."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total classes" value={classes.total} hint={`${nf(classes.active)} active`} accent={NEON} />
          <StatCard label="Active classes" value={classes.active} accent={NEON} />
          <StatCard label="Upcoming sessions" value={classes.upcomingSessions} hint={`${nf(classes.totalSessions)} held all-time`} accent={CYAN} />
          <StatCard label="Teachers" value={classes.teachers} accent={BLUE} />
          <StatCard label="Sessions held" value={classes.totalSessions} accent={BLUE} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Attendance rate" subtitle="Sessions marked attended, all recorded attendance.">
            <Meter value={classes.attendanceRate} label="Attended" color={NEON} />
          </Panel>
          <Panel title="Capacity fill" subtitle="Active enrollments against total seats in active classes.">
            <Meter value={classes.capacityFill} label="Seats filled" color={CYAN} />
          </Panel>
        </div>
      </Section>

      {/* ─── AI usage & cost ───────────────────────────────────────── */}
      <Section
        eyebrow="AI"
        title="AI usage & cost"
        description="Assistant interactions, cache efficiency, latency and provider mix."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total interactions" value={ai.totalInteractions} accent={NEON} />
          <StatCard label="Interactions (7 days)" value={ai.interactions7d} accent={CYAN} />
          <StatCard label="Cache-hit rate" value={pf(ai.cacheHitRate)} hint="Served from cache" accent={BLUE} />
          <StatCard
            label="Avg response"
            value={ai.avgResponseMs !== null ? `${nf(Math.round(ai.avgResponseMs))} ms` : "—"}
            hint={ai.avgResponseMs !== null ? undefined : "Awaiting data"}
            accent={AMBER}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel
            title="Interactions — last 14 days"
            subtitle={`${nf(ai.trend.reduce((s, d) => s + d.count, 0))} interactions in the window`}
          >
            <Sparkline points={ai.trend} color={CYAN} height={64} label="AI interactions per day, last 14 days" />
            <div className="mt-2 flex justify-between text-[11px] text-gray-400">
              <span>{formatDay(ai.trend[0]?.day)}</span>
              <span>{formatDay(ai.trend[ai.trend.length - 1]?.day)}</span>
            </div>
          </Panel>
          <Panel title="Provider mix" subtitle="Interactions grouped by serving provider.">
            <BarChart data={providerData} color={BLUE} emptyLabel="No AI interactions yet" />
          </Panel>
        </div>
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">Note:</span> per-token dollar cost is not shown — it
          requires token metering per interaction, which the platform does not track yet. Interaction counts,
          cache-hit rate and provider mix are exact.
        </p>
      </Section>

      {/* ─── Ops & health ──────────────────────────────────────────── */}
      <Section
        eyebrow="Operations"
        title="Ops & health"
        description="Notification delivery, moderation backlog, audit activity and database status."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Posts pending review" value={ops.postsPendingReview} accent={ops.postsPendingReview > 0 ? AMBER : NEON} />
          <StatCard label="Audit events (24h)" value={auditEvents24h} accent={CYAN} />
          <StatCard label="Notifications sent" value={notifMap.get("SENT") ?? 0} accent={NEON} />
          <StatCard
            label="Database"
            value={ops.dbStatus === "ok" ? "Operational" : "Degraded"}
            accent={ops.dbStatus === "ok" ? NEON : RED}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Notification delivery" subtitle={`${nf(notifTotal)} notifications attempted.`}>
            <ul className="space-y-2.5">
              {notifRows.map((r) => (
                <li key={r.key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-700">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                    {r.label}
                  </span>
                  <span className="tabular-nums font-semibold text-gray-900">{nf(r.count)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Meter value={ops.deliveryRate} label="Delivery rate" color={NEON} />
            </div>
          </Panel>
          <Panel title="System status">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Database</dt>
                <dd>
                  <StatusBadge ok={ops.dbStatus === "ok"} okLabel="Operational" badLabel="Degraded" />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Notification delivery</dt>
                <dd>
                  <StatusBadge
                    ok={ops.deliveryRate >= 0.9 || notifTotal === 0}
                    okLabel={notifTotal === 0 ? "No traffic" : "Healthy"}
                    badLabel="Degraded"
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Moderation backlog</dt>
                <dd>
                  <StatusBadge
                    ok={ops.postsPendingReview === 0}
                    okLabel="Clear"
                    badLabel={`${nf(ops.postsPendingReview)} pending`}
                  />
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </Section>

      <p className="text-center text-xs text-gray-400">
        Generated {new Date(kpis.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}

function StatusBadge({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? "bg-neon-50 text-neon-700" : "bg-red-50 text-red-700"
      }`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-neon-500" : "bg-red-500"}`} />
      {ok ? okLabel : badLabel}
    </span>
  );
}

function formatDay(day: string | undefined): string {
  if (!day) return "";
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
