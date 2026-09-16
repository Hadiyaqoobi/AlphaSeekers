/**
 * Public class join page — /[locale]/join/[classId]
 *
 * Reachable WITHOUT signing in. That is the entire point: a student arriving
 * from a poster, a WhatsApp message or the landing page previously hit a login
 * wall before they could see anything, and the class detail page still
 * redirects signed-out visitors away.
 *
 * Shows only public facts about the class — never the meeting link, the roster
 * or the materials. Those appear on the real class page once they are in.
 */
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ClassJoinForm } from "@/components/classes/class-join-form";
import { getPublicClassForJoin } from "@/lib/platform/class-join";
import { getSessionUser } from "@/lib/security/session";
import { redirect } from "next/navigation";

type JoinPageProps = {
  params: { locale: string; classId: string };
};

export default async function JoinClassPage({ params }: JoinPageProps) {
  const { locale, classId } = params;
  const t = await getTranslations({ locale, namespace: "classJoin" });

  const klass = await getPublicClassForJoin(classId);
  if (!klass) notFound();

  // Already signed in? They do not need an account — send them to the class
  // itself, where the normal join control lives.
  const user = await getSessionUser();
  if (user) {
    redirect(`/${locale}/classes/${classId}`);
  }

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10 sm:py-14">
      {/* What they are joining, stated before anything is asked of them. */}
      <section className="rounded-2xl border border-line-soft bg-dark-50/40 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-neon-400" dir="auto">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-black leading-tight text-ink-main" dir="auto">
          {klass.name}
        </h1>

        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {klass.teacherName ? (
            <div className="flex gap-2">
              <dt className="text-ink-faint">{t("teacher")}</dt>
              <dd className="font-semibold text-ink-soft" dir="auto">{klass.teacherName}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="text-ink-faint">{t("subject")}</dt>
            <dd className="font-semibold text-ink-soft" dir="auto">{klass.subjectCategory}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-faint">{t("when")}</dt>
            <dd className="font-semibold text-ink-soft" dir="auto">{klass.schedulePreference}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-faint">{t("seatsLeft")}</dt>
            <dd className="font-semibold text-ink-soft">{klass.seatsLeft}</dd>
          </div>
        </dl>

        {klass.description ? (
          <p className="mt-4 text-sm leading-relaxed text-ink-soft" dir="auto">
            {klass.description}
          </p>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-line-soft bg-dark-50/40 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-ink-main" dir="auto">{t("formTitle")}</h2>
        <p className="mb-5 mt-1 text-sm text-ink-soft" dir="auto">{t("formSubtitle")}</p>

        <ClassJoinForm classId={klass.id} isFull={klass.isFull} locale={locale} />
      </section>
    </main>
  );
}
