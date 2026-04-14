import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { formatDateTime } from "@/lib/format-date";
import { GoogleConnectCard } from "@/components/dashboard/google-connect-card";
import { JoinNowCard } from "@/components/dashboard/join-now-card";
import { OfflineSchedule } from "@/components/dashboard/offline-schedule";
import { LogoutButton } from "@/components/logout-button";
import {
  getDashboardStats,
  getJoinNowSession,
  listStudentClasses,
  listTeacherClasses,
  listTodaySessions,
  listUserNotifications,
} from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type DashboardPageProps = {
  params: { locale: string };
  searchParams: { google?: "connected" | "failed" };
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  void cookies();

  const { locale } = params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const navT = await getTranslations({ locale, namespace: "nav" });

  const stats = await getDashboardStats();
  const todaySessions = (await listTodaySessions()).slice(0, 8);
  const joinNow = user.role === "STUDENT" ? await getJoinNowSession(user.id) : null;
  const myClasses = user.role === "STUDENT" ? (await listStudentClasses(user.id)).slice(0, 4) : [];
  const teacherClasses = user.role === "TEACHER" ? await listTeacherClasses(user.id) : [];
  const notifications = (await listUserNotifications(user.id)).slice(0, 6);

  const initial = (user.name ?? "U").charAt(0).toUpperCase();

  const roleBadgeColor =
    user.role === "ADMIN"
      ? "bg-violet-100 text-violet-700"
      : user.role === "TEACHER"
        ? "bg-sky-100 text-sky-700"
        : "bg-emerald-100 text-emerald-700";

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-8">
      {/* ── Join-Now Banner ─────────────────────────────────── */}
      {joinNow ? <JoinNowCard session={joinNow} /> : null}

      {/* ── Welcome Header ──────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Avatar */}
        <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200/60">
          <span className="text-xl font-bold text-white leading-none">{initial}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl tracking-tight">
              {t("welcome")}, {user.name}
            </h1>
            <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${roleBadgeColor}`}>
              {user.role}
            </span>
          </div>

          {/* Action Pill Buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {user.role === "TEACHER" || user.role === "ADMIN" ? (
              <Link
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow"
                href={`/${locale}/teacher/availability`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {navT("teacher")}
              </Link>
            ) : null}
            {user.role === "ADMIN" ? (
              <Link
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 hover:shadow"
                href={`/${locale}/admin/classes`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {navT("admin")}
              </Link>
            ) : null}
            <Link
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow"
              href={`/${locale}/profile`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {navT("profile")}
            </Link>
            <LogoutButton callbackUrl={`/${locale}`} label={navT("logout")} />
          </div>
        </div>
      </header>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {/* Classes */}
        <article className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 sm:p-6 transition-shadow hover:shadow-md">
          <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
          <p className="text-3xl font-extrabold text-emerald-700 tracking-tight">{stats.activeClasses}</p>
          <p className="mt-1 text-sm font-medium text-emerald-600/80">{t("cards.classes")}</p>
        </article>

        {/* Students */}
        <article className="relative overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/60 p-5 sm:p-6 transition-shadow hover:shadow-md">
          <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-sky-100 text-sky-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <p className="text-3xl font-extrabold text-sky-700 tracking-tight">{stats.students}</p>
          <p className="mt-1 text-sm font-medium text-sky-600/80">{t("cards.students")}</p>
        </article>

        {/* Teachers */}
        <article className="relative overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/60 p-5 sm:p-6 transition-shadow hover:shadow-md">
          <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 text-violet-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <p className="text-3xl font-extrabold text-violet-700 tracking-tight">{stats.teachers}</p>
          <p className="mt-1 text-sm font-medium text-violet-600/80">{t("cards.teachers")}</p>
        </article>

        {/* Today's Sessions */}
        <article className="relative overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/60 p-5 sm:p-6 transition-shadow hover:shadow-md">
          <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-3xl font-extrabold text-amber-700 tracking-tight">{stats.sessionsToday}</p>
          <p className="mt-1 text-sm font-medium text-amber-600/80">{t("cards.today")}</p>
        </article>
      </div>

      {/* ── Main Content Grid ───────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Google Calendar / Offline Schedule */}
        {user.role === "TEACHER" || user.role === "ADMIN" ? (
          <GoogleConnectCard locale={locale} notice={searchParams.google} />
        ) : null}

        {user.role === "STUDENT" ? <OfflineSchedule /> : null}

        {/* ── Classes Section ─────────────────────────────────── */}
        {user.role === "STUDENT" ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{t("sections.myClasses")}</h3>
              </div>
              <Link className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2 transition-colors" href={`/${locale}/profile`}>
                {t("actions.viewProfile")}
              </Link>
            </div>

            <div className="space-y-3">
              {myClasses.map((item) => (
                <div className="group rounded-xl border border-slate-100 bg-white p-4 transition-all hover:shadow-md hover:border-slate-200 border-l-4 border-l-emerald-400" key={item.id}>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <div className="mt-1.5 flex flex-col gap-1">
                    <p className="flex items-center gap-1.5 text-sm text-slate-500">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      {item.teacherName}
                    </p>
                    <p className="flex items-center gap-1.5 text-sm text-slate-500">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {item.schedule}
                    </p>
                  </div>
                </div>
              ))}
              {myClasses.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center">
                  <p className="text-sm text-slate-500">{t("empty.noEnrollments")}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : user.role === "TEACHER" ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-100 text-sky-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{t("sections.myClasses")}</h3>
              </div>
              <Link className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2 transition-colors" href={`/${locale}/teacher/classes`}>
                {t("actions.viewAll")}
              </Link>
            </div>

            <div className="space-y-3">
              {teacherClasses.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center">
                  <p className="text-sm text-slate-500">{t("empty.noTeacherClasses")}</p>
                </div>
              ) : (
                teacherClasses.map((klass, idx) => {
                  const borderColors = ["border-l-sky-400", "border-l-violet-400", "border-l-emerald-400", "border-l-amber-400"];
                  const borderColor = borderColors[idx % borderColors.length];
                  return (
                    <Link
                      className={`group block rounded-xl border border-slate-100 bg-white p-4 transition-all hover:shadow-md hover:border-slate-200 border-l-4 ${borderColor}`}
                      href={`/${locale}/classes/${klass.id}`}
                      key={klass.id}
                    >
                      <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">{klass.name}</p>
                      <div className="mt-1.5 flex flex-col gap-1">
                        <p className="flex items-center gap-1.5 text-sm text-slate-500">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {klass.schedule}
                          <span className="text-slate-300 mx-0.5">&middot;</span>
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          {klass.enrolledCount} {t("cards.students").toLowerCase()}
                        </p>
                        {klass.sessions[0] ? (
                          <p className="flex items-center gap-1.5 text-sm text-slate-500">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {t("labels.nextSession")}: {formatDateTime(klass.sessions[klass.sessions.length - 1].startTime, locale)}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        ) : (
          /* Admin: Today's Sessions */
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t("sections.todaySessions")}</h3>
            </div>

            {todaySessions.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-500">{t("empty.noSessionsToday")}</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                {todaySessions.map((item, idx) => (
                  <div className="relative flex gap-4 pb-4 last:pb-0" key={item.id}>
                    {/* Timeline line */}
                    {idx < todaySessions.length - 1 ? (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200" />
                    ) : null}
                    {/* Timeline dot */}
                    <div className="relative z-10 flex-shrink-0 mt-1">
                      <div className="w-[23px] h-[23px] rounded-full border-2 border-emerald-400 bg-white flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 rounded-xl border border-slate-100 bg-white p-3.5 transition-all hover:shadow-sm hover:border-slate-200">
                      <p className="font-semibold text-slate-900">{item.className}</p>
                      <p className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {item.teacherName}
                      </p>
                      <p className="flex items-center gap-1.5 mt-0.5 text-sm text-slate-500">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {formatDateTime(item.startTime, locale)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Notifications ───────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 text-rose-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{t("sections.latestNotifications")}</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {notifications.length === 0 ? (
            <div className="sm:col-span-2 rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">{t("empty.noNotifications")}</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div className="group flex gap-3 rounded-xl border border-slate-100 bg-white p-4 transition-all hover:shadow-sm hover:border-slate-200" key={item.id}>
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed">{item.content}</p>
                  <p className="mt-1.5 text-xs font-medium text-slate-400">
                    {item.sentAt ? formatDateTime(item.sentAt, locale) : t("labels.pending")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
