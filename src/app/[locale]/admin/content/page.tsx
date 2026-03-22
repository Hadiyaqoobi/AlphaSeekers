import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { LibraryForm } from "@/components/forms/library-form";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { WebinarForm } from "@/components/forms/webinar-form";
import { getSessionUser } from "@/lib/security/session";

type AdminContentPageProps = {
  params: { locale: string };
};

export default async function AdminContentPage({ params }: AdminContentPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${params.locale}/login`);
  }

  if (user.role !== "ADMIN") {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "adminContent" });

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("kicker")}</p>
        <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("subtitle")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${params.locale}/admin/classes`}>
            {t("backToAdmin")}
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <WebinarForm />
        <OpportunityForm />
      </div>

      <LibraryForm />
    </section>
  );
}
