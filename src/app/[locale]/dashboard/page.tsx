import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { formatDateTime } from "@/lib/format-date";
import { GoogleConnectCard } from "@/components/dashboard/google-connect-card";
import { getTicketCounts } from "@/lib/platform/tickets";
import { JoinNowCard } from "@/components/dashboard/join-now-card";
import { OfflineSchedule } from "@/components/dashboard/offline-schedule";
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getGreetingDari(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "صبح بخیر";
  if (hour < 18) return "عصر بخیر";
  return "شب بخیر";
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  void cookies();

  const { locale } = params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });

  const isStudent = user.role === "STUDENT";
  const isTeacher = user.role === "TEACHER";
  const isAdmin = user.role === "ADMIN";

  // Fetch every independent data source concurrently instead of awaiting them
  // one-by-one. Role-specific queries are skipped (resolved to empty) when the
  // current role never renders them — in particular today's sessions are only
  // fetched for admins, which is also the sole consumer of the list, so we no
  // longer redundantly query today's sessions for students/teachers.
  const [stats, notificationsRaw, joinNow, myClassesRaw, teacherClasses, todaySessionsRaw, ticketCounts] =
    await Promise.all([
      getDashboardStats(),
      listUserNotifications(user.id),
      isStudent ? getJoinNowSession(user.id) : Promise.resolve(null),
      isStudent ? listStudentClasses(user.id) : Promise.resolve([]),
      isTeacher ? listTeacherClasses(user.id) : Promise.resolve([]),
      isAdmin ? listTodaySessions() : Promise.resolve([]),
      // The team files bugs and change requests here instead of emailing, so the
      // count belongs where an admin actually looks each day.
      isAdmin ? getTicketCounts() : Promise.resolve({ open: 0, inProgress: 0, urgentOpen: 0 }),
    ]);

  const notifications = notificationsRaw.slice(0, 6);
  const myClasses = myClassesRaw.slice(0, 4);
  const todaySessions = todaySessionsRaw.slice(0, 8);

  const firstName = (user.name ?? "").split(" ")[0] || "User";
  const greeting = locale === "fa" ? getGreetingDari() : getGreeting();
  const dateStr = new Date().toLocaleDateString(locale === "fa" ? "fa-AF" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const statCards = [
    { value: stats.activeClasses, label: t("cards.classes"), iconBg: "rgba(0, 230, 118, 0.10)", iconColor: "#00E676", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { value: stats.students, label: t("cards.students"), iconBg: "rgba(0, 229, 255, 0.10)", iconColor: "#00E5FF", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
    { value: stats.teachers, label: t("cards.teachers"), iconBg: "rgba(41, 121, 255, 0.10)", iconColor: "#2979FF", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    { value: stats.sessionsToday, label: t("cards.today"), iconBg: "rgba(255, 179, 0, 0.10)", iconColor: "#FFB300", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Join-Now Banner */}
      {joinNow ? <JoinNowCard session={joinNow} /> : null}

      {/* Header */}
      <header>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#E8EEF2" }}>{greeting}, {firstName}</h1>
            <p className="mt-1 text-sm" style={{ color: "#8AA4B8" }}>
              {stats.sessionsToday > 0
                ? `${stats.sessionsToday} ${t("cards.today").toLowerCase()} — ${dateStr}`
                : dateStr}
            </p>
          </div>
        </div>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl p-5"
            style={{ background: "#0D1419", border: "1px solid #1A2D3D" }}
          >
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ background: card.iconBg, color: card.iconColor }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
              </svg>
            </div>
            <p className="text-3xl font-bold mt-4" style={{ color: "#E8EEF2" }}>{card.value}</p>
            <p className="text-sm mt-1" style={{ color: "#8AA4B8" }}>{card.label}</p>
          </article>
        ))}
      </div>

      {/* Open support requests — the team reports issues in the platform now, so
          surface anything waiting rather than relying on someone opening the
          Support page unprompted. Hidden entirely when the queue is empty. */}
      {isAdmin && ticketCounts.open + ticketCounts.inProgress > 0 ? (
        <Link
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-white/10 bg-dark-100 px-5 py-4 transition-colors hover:border-neon-400/40"
          href={`/${locale}/admin/support`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              ticketCounts.urgentOpen > 0 ? "bg-red-400" : "bg-amber-400"
            }`}
          />
          <span className="font-semibold text-ink-main">
            {t("support.waiting", { count: ticketCounts.open + ticketCounts.inProgress })}
          </span>
          {ticketCounts.urgentOpen > 0 ? (
            <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-red-300">
              {t("support.urgent", { count: ticketCounts.urgentOpen })}
            </span>
          ) : null}
          <span className="ml-auto text-sm font-semibold text-neon-400">{t("support.review")} →</span>
        </Link>
      ) : null}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (spans 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Google Calendar / Offline Schedule */}
          {user.role === "TEACHER" || user.role === "ADMIN" ? (
            <GoogleConnectCard locale={locale} notice={searchParams.google} />
          ) : null}
          {user.role === "STUDENT" ? <OfflineSchedule /> : null}

          {/* Classes / Sessions */}
          {user.role === "STUDENT" ? (
            <section className="rounded-xl border border-white/5 bg-dark-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-ink-main">{t("sections.myClasses")}</h3>
                <Link className="text-sm text-neon-400 hover:text-neon-300" href={`/${locale}/classes`}>{t("actions.viewAll")}</Link>
              </div>
              {myClasses.length > 0 ? (
                <div className="space-y-3">
                  {myClasses.map((item) => (
                    <div className="flex items-center gap-4 rounded-lg p-3 hover:bg-white/5 transition-colors" key={item.id}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-500/10 text-neon-400 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-main">{item.name}</p>
                        <p className="text-xs text-ink-soft">{item.teacherName} &middot; {item.schedule}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-white/5 p-8 text-center">
                  <svg className="mx-auto w-8 h-8 text-ink-faint mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <p className="text-sm text-ink-soft">{t("empty.noEnrollments")}</p>
                  <Link className="text-xs text-neon-400 font-medium mt-2 inline-block" href={`/${locale}/classes`}>{t("actions.viewAll")}</Link>
                </div>
              )}
            </section>
          ) : user.role === "TEACHER" ? (
            <section className="rounded-xl border border-white/5 bg-dark-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-ink-main">{t("sections.myClasses")}</h3>
                <Link className="text-sm text-neon-400 hover:text-neon-300" href={`/${locale}/teacher/classes`}>{t("actions.viewAll")}</Link>
              </div>
              {teacherClasses.length > 0 ? (
                <div className="space-y-3">
                  {teacherClasses.map((klass) => (
                    <Link href={`/${locale}/classes/${klass.id}`} className="flex items-center gap-4 rounded-lg p-3 hover:bg-white/5 transition-colors" key={klass.id}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-main">{klass.name}</p>
                        <p className="text-xs text-ink-soft">{klass.schedule} &middot; {klass.enrolledCount} {t("cards.students").toLowerCase()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-white/5 p-8 text-center">
                  <p className="text-sm text-ink-soft">{t("empty.noTeacherClasses")}</p>
                </div>
              )}
            </section>
          ) : (
            /* Admin: Today's Sessions */
            <section className="rounded-xl border border-white/5 bg-dark-100 p-6">
              <h3 className="text-base font-semibold text-ink-main mb-5">{t("sections.todaySessions")}</h3>
              {todaySessions.length > 0 ? (
                <div className="space-y-2">
                  {todaySessions.map((item) => (
                    <div className="flex items-center gap-4 rounded-lg p-3 hover:bg-white/5 transition-colors" key={item.id}>
                      <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${item.meetLinkStatus === "GENERATED" ? "bg-neon-400" : item.meetLinkStatus === "PENDING" ? "bg-amber-400" : "bg-red-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-main">{item.className}</p>
                        <p className="text-xs text-ink-soft">{item.teacherName}</p>
                      </div>
                      <p className="text-xs text-ink-faint flex-shrink-0">{formatDateTime(item.startTime, locale)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-white/5 p-8 text-center">
                  <svg className="mx-auto w-8 h-8 text-ink-faint mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                  <p className="text-sm text-ink-soft">{t("empty.noSessionsToday")}</p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick Actions (Admin only) */}
          {user.role === "ADMIN" ? (
            <section className="rounded-xl border border-white/5 bg-dark-100 p-5">
              <h3 className="text-base font-semibold text-ink-main mb-4">{t("quickActions.heading")}</h3>
              <div className="space-y-1">
                {[
                  { href: `/${locale}/admin/classes`, label: t("quickActions.createClass"), icon: "M12 4.5v15m7.5-7.5h-15" },
                  { href: `/${locale}/admin/content`, label: t("quickActions.addOpportunity"), icon: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" },
                  { href: `/${locale}/admin/users`, label: t("quickActions.viewPendingUsers"), icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.97 5.97 0 00-.786-3.07M9 19.128v-.003c0-1.113.285-2.16.786-3.07M9 19.128H2.25a8.963 8.963 0 01-.727-3.071A3 3 0 014.5 10.365c.266-.068.54-.104.818-.104M9 19.128a5.97 5.97 0 01.786-3.07" },
                  { href: `/${locale}/admin/ai`, label: t("quickActions.aiDashboard"), icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
                  { href: `/${locale}/admin/support`, label: t("quickActions.support"), icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" },
                ].map((action) => (
                  <Link key={action.label} href={action.href} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-ink-main hover:bg-white/5 transition-colors">
                    <svg className="w-4 h-4 text-ink-faint flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={action.icon} /></svg>
                    {action.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Notifications */}
          {notifications.length > 0 ? (
            <section className="rounded-xl border border-white/5 bg-dark-100 p-5">
              <h3 className="text-base font-semibold text-ink-main mb-4">{t("sections.latestNotifications")}</h3>
              <div className="space-y-3">
                {notifications.map((item) => (
                  <div className="flex gap-3" key={item.id}>
                    <div className="flex-shrink-0 mt-1.5"><div className="w-2 h-2 rounded-full bg-neon-400" /></div>
                    <div className="min-w-0">
                      <p className="text-sm text-ink-main leading-relaxed">{item.content}</p>
                      <p className="text-xs text-ink-faint mt-1">{item.sentAt ? formatDateTime(item.sentAt, locale) : t("labels.pending")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
