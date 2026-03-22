import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { formatDateTime } from "@/lib/format-date";
import { listTeacherClasses } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type TeacherClassesPageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

export default async function TeacherClassesPage({ params }: TeacherClassesPageProps) {
  const { locale } = params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations({ locale, namespace: "teacherClasses" });
  const classes = await listTeacherClasses(user.id);

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("subtitle")}</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900 sm:text-4xl">
          {t("title")}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${locale}/dashboard`}>
            {t("backToDashboard")}
          </Link>
        </div>
      </header>

      {classes.length === 0 ? (
        <div className="panel panel-strong p-6 text-center text-slate-500">
          {t("empty")}
        </div>
      ) : (
        <div className="grid gap-4">
          {classes.map((klass) => (
            <article className="panel panel-strong p-4 sm:p-5" key={klass.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-black text-slate-900">{klass.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {klass.schedule} • {klass.durationMinutes} min
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {t("enrolledCount")}: {klass.enrolledCount}
                  </p>
                </div>
                <Link
                  className="btn-secondary"
                  href={`/${locale}/teacher/classes/${klass.id}/attendance`}
                >
                  {t("viewSummary")}
                </Link>
              </div>

              <div className="mt-3">
                <h3 className="text-sm font-semibold text-slate-700">{t("sessions")}</h3>
                {klass.sessions.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">{t("noSessions")}</p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {klass.sessions.map((session) => (
                      <div className="stat-card flex items-center justify-between p-3" key={session.id}>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatDateTime(session.startTime, locale)}
                          </p>
                        </div>
                        <Link
                          className="btn-secondary text-xs"
                          href={`/${locale}/teacher/classes/${klass.id}/sessions/${session.id}/attendance`}
                        >
                          {t("markAttendance")}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
