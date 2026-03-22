"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type ClassAttendance = {
  classId: string;
  className: string;
  totalSessions: number;
  sessionsAttended: number;
  attendanceRate: number;
};

type AttendanceData = {
  classes: ClassAttendance[];
  overallRate: number;
};

export function StudentAttendanceSummary() {
  const t = useTranslations("attendance");
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me/attendance")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="panel panel-strong p-4 text-center text-sm text-slate-500">
        {t("loading")}
      </div>
    );
  }

  if (!data || data.classes.length === 0) {
    return null;
  }

  return (
    <section className="panel panel-strong p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-slate-900">{t("myAttendance")}</h2>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
            data.overallRate >= 80
              ? "bg-emerald-100 text-emerald-700"
              : data.overallRate >= 50
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {t("overallRate")}: {data.overallRate}%
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        {data.classes.map((c) => (
          <article className="stat-card p-3" key={c.classId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">{c.className}</h3>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                  c.attendanceRate >= 80
                    ? "bg-emerald-100 text-emerald-700"
                    : c.attendanceRate >= 50
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {c.attendanceRate}%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {c.sessionsAttended} / {c.totalSessions} {t("attended")}
            </p>
            <div className="mt-2 progress-track">
              <div className="progress-fill" style={{ width: `${c.attendanceRate}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
