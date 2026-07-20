import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { StudentAttendanceSummary } from "@/components/attendance/student-attendance-summary";
import { LogoutButton } from "@/components/logout-button";
import { NotificationPrefs } from "@/components/notification-prefs";
import { PasswordChangeForm } from "@/components/profile/password-change-form";
import { PushSubscribe } from "@/components/pwa/push-subscribe";
import { TelegramLink } from "@/components/telegram-link";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { getStudentProfileSummary, getUser } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type ProfilePageProps = {
  params: { locale: string };
};

const PROGRESS_COLORS = [
  { bar: "from-neon-400 to-teal-500", badge: "bg-neon-50 text-neon-700" },
  { bar: "from-sky-400 to-blue-500", badge: "bg-sky-50 text-sky-700" },
  { bar: "from-violet-400 to-purple-500", badge: "bg-violet-50 text-violet-700" },
  { bar: "from-amber-400 to-orange-500", badge: "bg-amber-50 text-amber-700" },
] as const;

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = params;
  const user = await getSessionUser();
  const t = await getTranslations({ locale, namespace: "profile" });

  if (!user) {
    redirect(`/${locale}/login`);
  }

  /* ------------------------------------------------------------------ */
  /*  NON-STUDENT LAYOUT                                                */
  /* ------------------------------------------------------------------ */
  if (user.role !== "STUDENT") {
    const account = await getUser(user.id);

    return (
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Profile Header Card */}
        <div className="overflow-hidden rounded-2xl border border-line bg-dark-100 shadow-sm">
          <div className="h-24 bg-gradient-to-r from-teal-600 via-neon-600 to-cyan-600" />
          <div className="relative px-6 pb-6">
            <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-teal-500 to-neon-600 text-2xl font-bold text-white shadow-lg">
                  {(account?.name ?? user.name)?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
                <div className="pb-1">
                  <h1 className="text-2xl font-extrabold tracking-tight text-ink-main sm:text-3xl">
                    {account?.name ?? user.name}
                  </h1>
                  <span className="mt-1 inline-flex items-center rounded-full bg-teal-50 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-teal-700 ring-1 ring-teal-200/60">
                    {user.role}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pb-1">
                <Link className="btn-secondary !min-h-[2.25rem] !px-4 !text-sm" href={`/${locale}/dashboard`}>
                  {t("actions.backToDashboard")}
                </Link>
                {user.role === "TEACHER" || user.role === "ADMIN" ? (
                  <Link className="btn-secondary !min-h-[2.25rem] !px-4 !text-sm" href={`/${locale}/teacher/availability`}>
                    {t("actions.openAvailability")}
                  </Link>
                ) : null}
              </div>
            </div>

            <p className="mt-3 text-sm text-ink-soft">
              {t("notStudentBlurb", { role: user.role })}
            </p>
          </div>
        </div>

        {/* Integrations */}
        <div className="rounded-2xl border border-line bg-dark-100 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">Integrations</h2>
          <div className="flex flex-wrap items-center gap-3">
            <TelegramLink />
            <PushSubscribe />
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="rounded-2xl border border-line bg-dark-100 p-5 shadow-sm">
          <NotificationPrefs />
        </div>

        {/* Password Change */}
        <PasswordChangeForm />

        {/* Sign Out */}
        <div className="border-t border-line pt-5">
          <LogoutButton callbackUrl={`/${locale}/login`} label={t("actions.signOut")} />
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  STUDENT LAYOUT                                                    */
  /* ------------------------------------------------------------------ */
  const profile = await getStudentProfileSummary(user.id);

  if (!profile) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ============================================================
          Profile Header Card
          ============================================================ */}
      <div className="overflow-hidden rounded-2xl border border-line bg-dark-100 shadow-sm">
        {/* Gradient banner */}
        <div className="relative h-28 bg-gradient-to-r from-teal-600 via-neon-600 to-cyan-600 sm:h-32">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        </div>

        <div className="relative px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            {/* Avatar + Name */}
            <div className="flex items-end gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-teal-500 to-neon-600 text-3xl font-bold text-white shadow-xl">
                {profile.student.name?.charAt(0)?.toUpperCase() ?? "S"}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink-main sm:text-3xl">
                  {profile.student.name}
                </h1>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {profile.student.email}{" "}
                  {profile.student.phone
                    ? `\u00B7 ${"*".repeat(Math.max(0, profile.student.phone.length - 4))}${profile.student.phone.slice(-4)}`
                    : ""}
                </p>
              </div>
            </div>

            {/* Meta + Actions */}
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-dark-100 px-3 py-0.5 text-xs font-medium text-ink-soft">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {profile.student.timezone}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-200/60">
                  {profile.student.language}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="btn-secondary !min-h-[2.25rem] !px-4 !text-xs" href={`/${locale}/dashboard`}>
                  {t("actions.backToDashboard")}
                </Link>
                <Link className="btn-primary !min-h-[2.25rem] !px-4 !text-xs" href={`/${locale}/classes`}>
                  {t("actions.browseMoreClasses")}
                </Link>
              </div>
            </div>
          </div>

          {/* Integrations row */}
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
            <TelegramLink />
            <PushSubscribe />
          </div>
        </div>
      </div>

      {/* ============================================================
          Notification Preferences
          ============================================================ */}
      <div className="rounded-2xl border border-line bg-dark-100 p-5 shadow-sm sm:p-6">
        <NotificationPrefs />
      </div>

      {/* ============================================================
          Password Change
          ============================================================ */}
      <PasswordChangeForm />

      {/* ============================================================
          Stats Row
          ============================================================ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Classes */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-dark-100 p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-neon-50" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-100 text-neon-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-ink-main">{profile.stats.activeClasses}</p>
            <p className="mt-0.5 text-sm font-medium text-ink-soft">{t("stats.activeClasses")}</p>
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-dark-100 p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-sky-50" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-ink-main">{profile.stats.sessionsThisWeek}</p>
            <p className="mt-0.5 text-sm font-medium text-ink-soft">{t("stats.thisWeek")}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{t("stats.upcomingSessions")}</p>
          </div>
        </div>

        {/* Materials */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-dark-100 p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-violet-50" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-ink-main">{profile.stats.totalMaterials}</p>
            <p className="mt-0.5 text-sm font-medium text-ink-soft">{t("stats.materials")}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{t("stats.availableAcrossClasses")}</p>
          </div>
        </div>

        {/* Alerts */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-dark-100 p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-amber-50" />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-3 text-2xl font-extrabold text-ink-main">{profile.stats.notifications}</p>
            <p className="mt-0.5 text-sm font-medium text-ink-soft">{t("stats.alerts")}</p>
          </div>
        </div>
      </div>

      {/* ============================================================
          Class Progress
          ============================================================ */}
      <section className="rounded-2xl border border-line bg-dark-100 shadow-sm">
        <div className="border-b border-line-soft px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-ink-main">{t("progress.title")}</h2>
        </div>
        <div className="divide-y divide-line-soft">
          {profile.classes.length === 0 ? (
            <div className="px-5 py-10 text-center sm:px-6">
              <p className="text-sm text-ink-soft">{t("progress.empty")}</p>
            </div>
          ) : null}
          {profile.classes.map((item, index) => {
            const color = PROGRESS_COLORS[index % PROGRESS_COLORS.length];
            return (
              <article className="px-5 py-4 sm:px-6" key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink-main">{item.name}</h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${color.badge}`}>
                    {t("progress.progressPill", { percent: item.progressPercent })}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {item.teacherName} {"\u00B7"} {item.language} {"\u00B7"} {item.durationMinutes} {t("minutesShort")}
                </p>
                <p className="text-xs text-ink-faint">{item.schedule}</p>

                {/* Progress bar */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-dark-100">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${color.bar} transition-all duration-700`}
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                  <span>{t("progress.sessionsSummary", { completed: item.completedSessions, total: item.totalSessions })}</span>
                  <span>{t("progress.materialsSummary", { count: item.materialCount })}</span>
                </div>

                {item.nextSessionStart ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-ink-main">
                    <svg className="h-3.5 w-3.5 text-teal-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t("progress.next")}: {formatDateTime(item.nextSessionStart, locale, profile.student.timezone)}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-ink-faint">{t("progress.nextPending")}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          Attendance
          ============================================================ */}
      <StudentAttendanceSummary />

      {/* ============================================================
          Timeline + Notifications (two columns)
          ============================================================ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Timeline */}
        <section className="rounded-2xl border border-line bg-dark-100 shadow-sm">
          <div className="border-b border-line-soft px-5 py-4 sm:px-6">
            <h2 className="text-lg font-bold text-ink-main">{t("timeline.title")}</h2>
          </div>
          <div className="px-5 py-4 sm:px-6">
            {profile.upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">{t("timeline.empty")}</p>
            ) : (
              <div className="relative space-y-0">
                {/* Vertical line */}
                <div className="absolute bottom-0 left-[7px] top-2 w-0.5 bg-dark-200" />

                {profile.upcoming.map((item, idx) => (
                  <article className="relative pl-7 pb-6 last:pb-0" key={item.id}>
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-[3px] border-white shadow-sm ${idx === 0 ? "bg-teal-500" : "bg-dark-300"}`} />

                    <p className="text-sm font-semibold text-ink-main">{item.className}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {formatDateTime(item.startTime, locale, profile.student.timezone)}
                    </p>
                    {item.meetLink ? (
                      <a
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-neon-600 hover:text-neon-700 hover:underline"
                        href={item.meetLink}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {t("timeline.openLink")}
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-2xl border border-line bg-dark-100 shadow-sm">
          <div className="border-b border-line-soft px-5 py-4 sm:px-6">
            <h2 className="text-lg font-bold text-ink-main">{t("notifications.title")}</h2>
          </div>
          <div className="divide-y divide-line-soft">
            {profile.notifications.length === 0 ? (
              <div className="px-5 py-10 text-center sm:px-6">
                <p className="text-sm text-ink-soft">{t("notifications.empty")}</p>
              </div>
            ) : null}
            {profile.notifications.map((item) => (
              <article className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-dark-50/50 sm:px-6" key={item.id}>
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-main">{item.content}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {formatDateTime(item.sentAt ?? item.createdAt, locale, profile.student.timezone)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* ============================================================
          Opportunities
          ============================================================ */}
      <section className="rounded-2xl border border-line bg-dark-100 shadow-sm">
        <div className="border-b border-line-soft px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-ink-main">{t("opportunities.title")}</h2>
        </div>
        <div className="p-5 sm:p-6">
          {profile.opportunities.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">{t("opportunities.empty")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.opportunities.map((item) => (
                <article
                  className="group relative overflow-hidden rounded-xl border border-line bg-dark-100 p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-ink-main group-hover:text-teal-700 transition-colors">
                      {item.title}
                    </h3>
                    <span className="badge-pill">{item.type}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{item.description}</p>

                  {/* Deadline badge */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/60">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t("opportunities.deadline")}: {formatDate(item.deadline, locale, profile.student.timezone)}
                    </span>
                    <a
                      className="inline-flex items-center gap-1 text-xs font-semibold text-neon-600 hover:text-neon-700 hover:underline"
                      href={item.externalUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {t("opportunities.viewOpportunity")}
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================
          Sign Out
          ============================================================ */}
      <div className="border-t border-line pt-5">
        <LogoutButton callbackUrl={`/${locale}/login`} label={t("actions.signOut")} />
      </div>
    </section>
  );
}
