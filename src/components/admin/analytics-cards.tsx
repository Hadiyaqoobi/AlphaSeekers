"use client";

import { useTranslations } from "next-intl";

type AnalyticsData = {
  users: {
    total: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
    recentSignups: number;
  };
  classes: {
    total: number;
    active: number;
    totalEnrollments: number;
  };
  attendance: {
    overallRate: number;
  };
};

export function AnalyticsCards({ data }: { data: AnalyticsData }) {
  const t = useTranslations("analytics");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <p className="text-sm font-semibold text-ink-soft">{t("totalUsers")}</p>
          <p className="text-3xl font-black text-ink-main">{data.users.total}</p>
        </div>

        <div className="stat-card">
          <p className="text-sm font-semibold text-ink-soft">{t("activeClasses")}</p>
          <p className="text-3xl font-black text-ink-main">{data.classes.active}</p>
        </div>

        <div className="stat-card">
          <p className="text-sm font-semibold text-ink-soft">{t("totalEnrollments")}</p>
          <p className="text-3xl font-black text-ink-main">{data.classes.totalEnrollments}</p>
        </div>

        <div className="stat-card">
          <p className="text-sm font-semibold text-ink-soft">{t("attendanceRate")}</p>
          <p className="text-3xl font-black text-ink-main">{data.attendance.overallRate}%</p>
          <div className="mt-2 h-2 w-full rounded-full bg-dark-200">
            <div
              className="h-2 rounded-full bg-neon-500 transition-all"
              style={{ width: `${Math.min(data.attendance.overallRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="panel p-4">
          <h3 className="text-sm font-bold text-ink-main">{t("usersByRole")}</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(data.users.byRole).map(([role, count]) => {
              const pct = data.users.total > 0 ? Math.round((count / data.users.total) * 100) : 0;
              return (
                <div key={role}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink-soft">{role}</span>
                    <span className="font-bold text-ink-main">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-dark-200">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="text-sm font-bold text-ink-main">{t("usersByStatus")}</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(data.users.byStatus).map(([status, count]) => {
              const pct = data.users.total > 0 ? Math.round((count / data.users.total) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink-soft">{status}</span>
                    <span className="font-bold text-ink-main">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-dark-200">
                    <div
                      className="h-1.5 rounded-full bg-amber-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel p-4">
          <h3 className="text-sm font-bold text-ink-main">{t("recentSignups")}</h3>
          <p className="mt-3 text-3xl font-black text-ink-main">{data.users.recentSignups}</p>
        </div>
      </div>
    </div>
  );
}
