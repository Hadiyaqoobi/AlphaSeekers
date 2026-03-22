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

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      {joinNow ? <JoinNowCard session={joinNow} /> : null}

      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {t("welcome")}, {user.name}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {user.role === "TEACHER" || user.role === "ADMIN" ? (
            <Link className="btn-secondary" href={`/${locale}/teacher/availability`}>
              {navT("teacher")}
            </Link>
          ) : null}
          {user.role === "ADMIN" ? (
            <Link className="btn-secondary" href={`/${locale}/admin/classes`}>
              {navT("admin")}
            </Link>
          ) : null}
          <Link className="btn-secondary" href={`/${locale}/profile`}>
            {navT("profile")}
          </Link>
          <LogoutButton callbackUrl={`/${locale}`} label={navT("logout")} />
        </div>
      </header>

      <div className="stats-grid grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
        <article className="bg-white p-5">
          <p className="text-sm font-medium text-slate-500">{t("cards.classes")}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.activeClasses}</p>
        </article>
        <article className="bg-white p-5">
          <p className="text-sm font-medium text-slate-500">{t("cards.students")}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.students}</p>
        </article>
        <article className="bg-white p-5">
          <p className="text-sm font-medium text-slate-500">{t("cards.teachers")}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.teachers}</p>
        </article>
        <article className="bg-white p-5">
          <p className="text-sm font-medium text-slate-500">{t("cards.today")}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.sessionsToday}</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {user.role === "TEACHER" || user.role === "ADMIN" ? (
          <GoogleConnectCard locale={locale} notice={searchParams.google} />
        ) : null}

        {user.role === "STUDENT" ? <OfflineSchedule /> : null}

        {user.role === "STUDENT" ? (
          <section className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{t("sections.myClasses")}</h3>
              <Link className="text-sm font-medium text-emerald-700 hover:underline" href={`/${locale}/profile`}>
                {t("actions.viewProfile")}
              </Link>
            </div>
            {myClasses.map((item) => (
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50" key={item.id}>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">{item.teacherName}</p>
                <p className="text-sm text-slate-500">{item.schedule}</p>
              </div>
            ))}
            {myClasses.length === 0 ? <p className="text-sm text-slate-500">{t("empty.noEnrollments")}</p> : null}
          </section>
        ) : user.role === "TEACHER" ? (
          <section className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{t("sections.myClasses")}</h3>
              <Link className="text-sm font-medium text-emerald-700 hover:underline" href={`/${locale}/teacher/classes`}>
                {t("actions.viewAll")}
              </Link>
            </div>
            {teacherClasses.length === 0 ? (
              <p className="text-sm text-slate-500">{t("empty.noTeacherClasses")}</p>
            ) : (
              teacherClasses.map((klass) => (
                <Link className="block rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-all hover:bg-slate-50 hover:shadow-sm" href={`/${locale}/classes/${klass.id}`} key={klass.id}>
                  <p className="font-medium text-slate-900">{klass.name}</p>
                  <p className="text-sm text-slate-500">{klass.schedule} &middot; {klass.enrolledCount} {t("cards.students").toLowerCase()}</p>
                  {klass.sessions[0] ? (
                    <p className="text-sm text-slate-500">{t("labels.nextSession")}: {formatDateTime(klass.sessions[klass.sessions.length - 1].startTime, locale)}</p>
                  ) : null}
                </Link>
              ))
            )}
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-3 shadow-sm">
            <h3 className="font-semibold text-slate-900">{t("sections.todaySessions")}</h3>
            {todaySessions.length === 0 ? <p className="text-sm text-slate-500">{t("empty.noSessionsToday")}</p> : null}
            {todaySessions.map((item) => (
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50" key={item.id}>
                <p className="font-medium text-slate-900">{item.className}</p>
                <p className="text-sm text-slate-500">{item.teacherName}</p>
                <p className="text-sm text-slate-500">{formatDateTime(item.startTime, locale)}</p>
              </div>
            ))}
          </section>
        )}
      </div>

      <section className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">{t("sections.latestNotifications")}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500">{t("empty.noNotifications")}</p>
          ) : (
            notifications.map((item) => (
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50" key={item.id}>
                <p className="mt-1 text-sm text-slate-700">{item.content}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.sentAt ? formatDateTime(item.sentAt, locale) : t("labels.pending")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
