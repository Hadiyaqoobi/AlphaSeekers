import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { formatDate } from "@/lib/format-date";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { listOpportunities } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type OpportunitiesPageProps = {
  params: { locale: string };
  searchParams: { type?: string };
};

const FILTERS = ["ALL", "SCHOLARSHIP", "JOB", "INTERNSHIP", "GRANT"] as const;

export default async function OpportunitiesPage({ params, searchParams }: OpportunitiesPageProps) {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "opportunities" });
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (!user.approved && user.role !== "ADMIN") {
    redirect(`/${locale}/pending-approval`);
  }

  const currentType = searchParams.type ?? "ALL";
  const items = await listOpportunities(currentType === "ALL" ? undefined : currentType);

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("title")}</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900 sm:text-4xl">{t("subtitle")}</h1>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Link
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-xs font-semibold ${
                currentType === filter
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white/80 text-slate-700"
              }`}
              href={`/${locale}/opportunities?type=${filter}`}
              key={filter}
            >
              {t(`filters.${filter}`)}
            </Link>
          ))}
        </div>
      </header>

      {user?.role === "ADMIN" ? <OpportunityForm /> : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <article className="panel panel-strong p-4" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-black text-slate-900">{item.title}</h2>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  item.expired ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {item.expired ? t("expired") : t(`types.${item.type}`)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{item.description}</p>
            <p className="mt-2 text-xs font-semibold text-slate-600">
              {t("deadline")}: {formatDate(item.deadline, locale)}
            </p>
            <a className="mt-2 inline-flex text-sm font-semibold text-sky-700 underline-offset-2 hover:underline" href={item.externalUrl} rel="noreferrer" target="_blank">
              {t("openOpportunity")}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
