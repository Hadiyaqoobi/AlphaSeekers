import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { getTeacherSetupStatus } from "@/lib/platform/teacher-setup";
import { getSessionUser } from "@/lib/security/session";

type SetupPageProps = { params: { locale: string } };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: SetupPageProps) {
  const t = await getTranslations({ locale: params.locale, namespace: "teacherSetup" });
  return { title: `${t("title")} — AlphaSeekers` };
}

export default async function TeacherSetupPage({ params }: SetupPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${params.locale}/login`);
  }

  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    redirect(`/${params.locale}/dashboard`);
  }

  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "teacherSetup" });
  const status = await getTeacherSetupStatus(user.id);

  return (
    <section className="mx-auto max-w-3xl px-6 py-10 lg:px-8">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-400">{t("kicker")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-main sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
          {status.complete ? t("subtitleDone") : t("subtitle")}
        </p>
      </header>

      <ol className="space-y-4">
        <StepCard
          action={
            <Link className="btn-primary px-5 py-2.5 text-sm" href={`/${locale}/teacher/availability`}>
              {status.availabilitySet ? t("step1Change") : t("step1Cta")}
            </Link>
          }
          body={
            status.availabilitySet
              ? t("step1Done", { days: status.availabilityDays })
              : t("step1Body")
          }
          done={status.availabilitySet}
          number={1}
          title={t("step1Title")}
        />

        <StepCard
          action={
            <a
              className="btn-primary inline-block px-5 py-2.5 text-sm"
              href={`/api/integrations/google/connect?locale=${locale}`}
            >
              {status.googleConnected ? t("step2Change") : t("step2Cta")}
            </a>
          }
          body={
            status.googleConnected
              ? t("step2Done", { account: status.googleAccountEmail ?? "" })
              : t("step2Body")
          }
          done={status.googleConnected}
          number={2}
          title={t("step2Title")}
        />
      </ol>

      {/* Their own classes, so the consequence of the checklist is concrete. */}
      {status.classes.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-ink-main">{t("yourClasses")}</h2>
          <ul className="mt-4 space-y-3">
            {status.classes.map((c) => (
              <li className="rounded-2xl border border-white/5 bg-dark-100 p-5" key={c.id}>
                <p className="font-semibold text-ink-main">{c.name}</p>
                {c.schedulePreference ? (
                  <p className="mt-1 text-sm text-ink-soft">{c.schedulePreference}</p>
                ) : null}
                <p className="mt-3 text-sm">
                  {c.upcomingSessions > 0 ? (
                    <span className="text-neon-400">
                      {t("sessionsScheduled", { count: c.upcomingSessions })}
                    </span>
                  ) : status.complete ? (
                    // Both steps done: the class is queued, not blocked. Telling
                    // them to "finish the steps above" here would be wrong.
                    <span className="text-ink-soft">{t("sessionsComing")}</span>
                  ) : (
                    <span className="text-amber-300">{t("noSessionsYet")}</span>
                  )}
                  <span className="text-ink-faint"> · {t("enrolled", { count: c.enrolledCount })}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10 rounded-2xl border border-white/5 bg-dark-100 p-6">
        <h2 className="text-base font-semibold text-ink-main">{t("nextTitle")}</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-soft">
          <li>{t("next1")}</li>
          <li>{t("next2")}</li>
          <li>{t("next3")}</li>
        </ul>
        <p className="mt-4 text-sm text-ink-soft">
          {t("helpPrefix")}{" "}
          <Link className="text-neon-400 underline" href={`/${locale}/admin/support`}>
            {t("helpLink")}
          </Link>
          {t("helpSuffix")}
        </p>
      </section>
    </section>
  );
}

function StepCard({
  number,
  title,
  body,
  done,
  action,
}: {
  number: number;
  title: string;
  body: string;
  done: boolean;
  action: React.ReactNode;
}) {
  return (
    <li
      className={`rounded-2xl border p-6 ${
        done ? "border-neon-400/30 bg-neon-400/5" : "border-white/10 bg-dark-100"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold ${
            done ? "bg-neon-400 text-black" : "border-2 border-white/20 text-ink-soft"
          }`}
        >
          {done ? "✓" : number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink-main">{title}</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">{body}</p>
          <div className="mt-4">{action}</div>
        </div>
      </div>
    </li>
  );
}
