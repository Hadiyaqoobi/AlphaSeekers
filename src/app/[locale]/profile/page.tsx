import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { StudentAttendanceSummary } from "@/components/attendance/student-attendance-summary";
import { LogoutButton } from "@/components/logout-button";
import { NotificationPrefs } from "@/components/notification-prefs";
import { PushSubscribe } from "@/components/pwa/push-subscribe";
import { TelegramLink } from "@/components/telegram-link";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { getStudentProfileSummary, getUser } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type ProfilePageProps = {
  params: { locale: string };
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = params;
  const user = await getSessionUser();
  const t = await getTranslations({ locale, namespace: "profile" });

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (user.role !== "STUDENT") {
    const account = await getUser(user.id);

    return (
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{account?.name ?? user.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("notStudentBlurb", { role: user.role })}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn-secondary" href={`/${locale}/dashboard`}>
              {t("actions.backToDashboard")}
            </Link>
            {user.role === "TEACHER" || user.role === "ADMIN" ? (
              <Link className="btn-secondary" href={`/${locale}/teacher/availability`}>
                {t("actions.openAvailability")}
              </Link>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <TelegramLink />
            <PushSubscribe />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <NotificationPrefs />
          </div>
          <div className="mt-6 border-t border-slate-200 pt-4">
            <LogoutButton callbackUrl={`/${locale}/login`} label={t("actions.signOut")} />
          </div>
        </header>
      </section>
    );
  }

  const profile = await getStudentProfileSummary(user.id);

  if (!profile) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{profile.student.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {profile.student.email} {profile.student.phone ? `\u00B7 ${"*".repeat(Math.max(0, profile.student.phone.length - 4))}${profile.student.phone.slice(-4)}` : ""}
            </p>
          </div>
          <div className="text-end text-xs text-slate-500">
            <p>{profile.student.timezone}</p>
            <p>{profile.student.language}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${locale}/dashboard`}>
            {t("actions.backToDashboard")}
          </Link>
          <Link className="btn-secondary" href={`/${locale}/classes`}>
            {t("actions.browseMoreClasses")}
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TelegramLink />
          <PushSubscribe />
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <NotificationPrefs />
        </div>
      </header>

      <div className="grid gap-px bg-slate-200 rounded-lg overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
        <article className="bg-white p-4">
          <p className="text-sm text-slate-500">{t("stats.activeClasses")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{profile.stats.activeClasses}</p>
        </article>
        <article className="bg-white p-4">
          <p className="text-sm text-slate-500">{t("stats.thisWeek")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{profile.stats.sessionsThisWeek}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("stats.upcomingSessions")}</p>
        </article>
        <article className="bg-white p-4">
          <p className="text-sm text-slate-500">{t("stats.materials")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{profile.stats.totalMaterials}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("stats.availableAcrossClasses")}</p>
        </article>
        <article className="bg-white p-4">
          <p className="text-sm text-slate-500">{t("stats.alerts")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{profile.stats.notifications}</p>
        </article>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-slate-900">{t("progress.title")}</h2>
        <div className="mt-3 space-y-3">
          {profile.classes.length === 0 ? <p className="text-sm text-slate-500">{t("progress.empty")}</p> : null}
          {profile.classes.map((item) => (
            <article className="rounded-lg border border-slate-100 p-3" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-slate-900">{item.name}</h3>
                <span className="badge-pill">{t("progress.progressPill", { percent: item.progressPercent })}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {item.teacherName} \u00B7 {item.language} \u00B7 {item.durationMinutes} {t("minutesShort")}
              </p>
              <p className="text-xs text-slate-500">{item.schedule}</p>
              <div className="mt-2 progress-track">
                <div className="progress-fill" style={{ width: `${item.progressPercent}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{t("progress.sessionsSummary", { completed: item.completedSessions, total: item.totalSessions })}</span>
                <span>{t("progress.materialsSummary", { count: item.materialCount })}</span>
              </div>
              {item.nextSessionStart ? (
                <p className="mt-1 text-xs font-medium text-slate-700">
                  {t("progress.next")}: {formatDateTime(item.nextSessionStart, locale, profile.student.timezone)}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">{t("progress.nextPending")}</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <StudentAttendanceSummary />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900">{t("timeline.title")}</h2>
          <div className="mt-3 space-y-2">
            {profile.upcoming.length === 0 ? <p className="text-sm text-slate-500">{t("timeline.empty")}</p> : null}
            {profile.upcoming.map((item) => (
              <article className="rounded-lg border border-slate-100 p-3" key={item.id}>
                <p className="font-medium text-slate-900">{item.className}</p>
                <p className="text-xs text-slate-500">{formatDateTime(item.startTime, locale, profile.student.timezone)}</p>
                {item.meetLink ? (
                  <a className="text-xs font-medium text-emerald-700 hover:underline" href={item.meetLink} rel="noreferrer" target="_blank">
                    {t("timeline.openLink")}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900">{t("notifications.title")}</h2>
          <div className="mt-3 space-y-2">
            {profile.notifications.length === 0 ? <p className="text-sm text-slate-500">{t("notifications.empty")}</p> : null}
            {profile.notifications.map((item) => (
              <article className="rounded-lg border border-slate-100 p-3" key={item.id}>
                <p className="text-sm text-slate-700">{item.content}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDateTime(item.sentAt ?? item.createdAt, locale, profile.student.timezone)}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-slate-900">{t("opportunities.title")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {profile.opportunities.length === 0 ? <p className="text-sm text-slate-500">{t("opportunities.empty")}</p> : null}
          {profile.opportunities.map((item) => (
            <article className="rounded-lg border border-slate-100 p-3" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-slate-900">{item.title}</h3>
                <span className="badge-pill">{item.type}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                {t("opportunities.deadline")}: {formatDate(item.deadline, locale, profile.student.timezone)}
              </p>
              <a className="mt-1 inline-flex text-xs font-medium text-emerald-700 hover:underline" href={item.externalUrl} rel="noreferrer" target="_blank">
                {t("opportunities.viewOpportunity")}
              </a>
            </article>
          ))}
        </div>
      </section>

      <div className="border-t border-slate-200 pt-4">
        <LogoutButton callbackUrl={`/${locale}/login`} label={t("actions.signOut")} />
      </div>
    </section>
  );
}
