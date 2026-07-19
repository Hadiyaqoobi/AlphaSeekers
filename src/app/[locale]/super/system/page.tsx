import Link from "next/link";

import { Meter } from "@/components/super/charts";
import { StatCard } from "@/components/super/stat-card";
import { getSuperKpis } from "@/lib/platform/super-store";
import { countRecentAudit } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

const NEON = "#00C853";
const AMBER = "#FFA000";
const RED = "#DC2626";
const CYAN = "#00B8D4";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const NOTIF_META: { key: string; label: string; color: string }[] = [
  { key: "SENT", label: "Sent", color: NEON },
  { key: "FAILED", label: "Failed", color: RED },
  { key: "PENDING", label: "Pending", color: AMBER },
];

type Props = { params: { locale: string } };

export default async function SuperSystemPage({ params }: Props) {
  const [kpis, auditEvents24h] = await Promise.all([
    getSuperKpis(),
    countRecentAudit(ONE_DAY_MS),
  ]);
  const { ops } = kpis;

  const notifMap = new Map(ops.notifications.map((n) => [n.status, n.count]));
  const knownKeys = new Set(NOTIF_META.map((m) => m.key));
  const notifRows = [
    ...NOTIF_META.map((m) => ({ ...m, count: notifMap.get(m.key) ?? 0 })),
    ...ops.notifications
      .filter((n) => !knownKeys.has(n.status))
      .map((n) => ({ key: n.status, label: n.status, color: "#6B7280", count: n.count })),
  ];
  const notifTotal = notifRows.reduce((s, r) => s + r.count, 0);
  const dbOk = ops.dbStatus === "ok";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">System health</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Live database status, notification delivery and moderation backlog.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Database"
          value={dbOk ? "Operational" : "Degraded"}
          hint={dbOk ? "Query probe succeeded" : "Query probe failed"}
          accent={dbOk ? NEON : RED}
        />
        <StatCard
          label="Delivery rate"
          value={`${Number((Math.max(0, Math.min(1, ops.deliveryRate)) * 100).toFixed(1))}%`}
          hint={`${notifTotal.toLocaleString()} notifications attempted`}
          accent={ops.deliveryRate >= 0.9 || notifTotal === 0 ? NEON : AMBER}
        />
        <StatCard
          label="Posts pending review"
          value={ops.postsPendingReview}
          hint={ops.postsPendingReview > 0 ? "Moderation backlog" : "Backlog clear"}
          accent={ops.postsPendingReview > 0 ? AMBER : NEON}
        />
        <StatCard label="Audit events (24h)" value={auditEvents24h} accent={CYAN} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Notification delivery</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {notifTotal.toLocaleString()} notifications attempted, by status.
          </p>
          <ul className="mt-4 space-y-2.5">
            {notifRows.map((r) => (
              <li key={r.key} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                  {r.label}
                </span>
                <span className="tabular-nums font-semibold text-gray-900">{r.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Meter value={ops.deliveryRate} label="Delivery rate" color={NEON} />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Related tools</h3>
          <p className="mt-0.5 text-xs text-gray-500">Deeper diagnostics and platform metrics.</p>
          <div className="mt-4 space-y-3">
            <Link
              href={`/${params.locale}/admin/ai`}
              className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <span>
                AI Health
                <span className="ml-2 font-normal text-gray-400">Provider status &amp; interaction logs</span>
              </span>
              <span aria-hidden className="text-gray-400">→</span>
            </Link>
            <Link
              href={`/${params.locale}/super`}
              className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <span>
                KPI overview
                <span className="ml-2 font-normal text-gray-400">Students, classes, AI &amp; ops trends</span>
              </span>
              <span aria-hidden className="text-gray-400">→</span>
            </Link>
            <Link
              href={`/${params.locale}/super/audit`}
              className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              <span>
                Audit log
                <span className="ml-2 font-normal text-gray-400">Privileged staff actions</span>
              </span>
              <span aria-hidden className="text-gray-400">→</span>
            </Link>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        Generated {new Date(kpis.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
