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
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("title")}</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900 sm:text-4xl">{t("availability")}</h1>
        <p className="mt-2 text-sm text-slate-700">
          {t("subtitle")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${params.locale}/dashboard`}>
            {t("backToDashboard")}
          </Link>
        </div>
      </header>

      <TeacherAvailabilityForm />
    </section>
  );
}
