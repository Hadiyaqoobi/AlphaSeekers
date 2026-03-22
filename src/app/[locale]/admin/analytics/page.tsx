import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { AnalyticsCards } from "@/components/admin/analytics-cards";
import { getAdminAnalytics } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type AdminAnalyticsPageProps = {
  params: { locale: string };
};

export default async function AdminAnalyticsPage({ params }: AdminAnalyticsPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${params.locale}/login`);
  }

  if (user.role !== "ADMIN") {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "analytics" });
  const analytics = await getAdminAnalytics();

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("title")}</p>
        <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("subtitle")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${params.locale}/admin/classes`}>
            {t("backToAdmin")}
          </Link>
        </div>
      </header>

      <AnalyticsCards data={analytics} />
    </section>
  );
}
