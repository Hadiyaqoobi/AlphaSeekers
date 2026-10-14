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
 *
 * The class summary is read through the public-page cache: crawlers follow
 * this page from the landing page and WhatsApp's link previewer fetches it,
 * and neither should wake the database. A signed-out visit does no database
 * work when the entry is cached (the session check below reads only the cookie).
 *
 * A signed-in student who is not in the class yet (typically just back from
 * "Join with Google") sees the class's questions and one Join button instead
 * of the account form. Everyone else who is signed in goes to the class page.
 */
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ClassJoinForm } from "@/components/classes/class-join-form";
import { getPublicJoinClass } from "@/lib/platform/public-data";
import { isRegistrationClosed } from "@/lib/platform/registration-deadline";
import { isStudentEnrolledInClass } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type JoinPageProps = {
  params: { locale: string; classId: string };
  searchParams?: { via?: string };
};

export default async function JoinClassPage({ params, searchParams }: JoinPageProps) {
  const { locale, classId } = params;
  const t = await getTranslations({ locale, namespace: "classJoin" });

  const klass = await getPublicJoinClass(classId);
  if (!klass) notFound();

  const user = await getSessionUser();
  const classPage = `/${locale}/classes/${classId}`;
  if (user && (user.role !== "STUDENT" || (await isStudentEnrolledInClass(user.id, classId)))) {
    redirect(classPage);
  }

  // Said up front, instead of letting a student fill in everything and only
  // then hear that registration closed. Compared to the clock on every render,
  // so it holds even while the class summary is cached.
  const closed = isRegistrationClosed(klass.registrationDeadline);

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
        {closed ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200" dir="auto">
            {t("errors.registrationClosed")}
          </p>
        ) : (
          <>
            <h2 className="text-lg font-bold text-ink-main" dir="auto">
              {user ? t("memberFormTitle") : t("formTitle")}
            </h2>
            <p className="mb-5 mt-1 text-sm text-ink-soft" dir="auto">
              {user ? t("memberFormSubtitle") : t("formSubtitle")}
            </p>

            <ClassJoinForm
              autoSubmit={searchParams?.via === "google"}
              classId={klass.id}
              isFull={klass.isFull}
              locale={locale}
              memberName={user?.name ?? null}
              mode={user ? "member" : "guest"}
              questions={klass.questions}
            />
          </>
        )}
      </section>
    </main>
  );
}
