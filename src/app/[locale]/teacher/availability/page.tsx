import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { TeacherAvailabilityForm } from "@/components/forms/teacher-availability-form";
import { getSessionUser } from "@/lib/security/session";

type TeacherAvailabilityPageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

export default async function TeacherAvailabilityPage({ params }: TeacherAvailabilityPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${params.locale}/login`);
  }

  if (user.role !== "TEACHER" && user.role !== "ADMIN") {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "teacherPage" });

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      {/* Page Header */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-400">
          {t("title")}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-main">
          {t("availability")}
        </h1>
        <p className="mt-2 text-base text-ink-soft">
          {t("subtitle")}
        </p>
        <div className="mt-6">
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/dashboard`}
          >
            <svg className="mr-2 h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("backToDashboard")}
          </Link>
        </div>
      </header>

      {/* Availability Form */}
      <div className="rounded-2xl border border-white/5 bg-dark-100">
        <TeacherAvailabilityForm />
      </div>
    </section>
  );
}
