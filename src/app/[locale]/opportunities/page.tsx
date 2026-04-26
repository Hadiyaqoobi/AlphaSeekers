import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { formatDate } from "@/lib/format-date";
import { DeleteContentButton } from "@/components/admin/delete-content-button";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { listOpportunities } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type OpportunitiesPageProps = {
  params: { locale: string };
  searchParams: { type?: string };
};

const FILTERS = ["ALL", "SCHOLARSHIP", "JOB", "INTERNSHIP", "GRANT"] as const;

const TYPE_COLORS: Record<string, string> = {
  SCHOLARSHIP: "bg-violet-50 text-violet-700",
  JOB: "bg-blue-50 text-blue-700",
  INTERNSHIP: "bg-amber-50 text-amber-700",
  GRANT: "bg-teal-50 text-teal-700",
};

export default async function OpportunitiesPage({ params, searchParams }: OpportunitiesPageProps) {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "opportunities" });
  const user = await getSessionUser();

  const currentType = searchParams.type ?? "ALL";
  const items = await listOpportunities(currentType === "ALL" ? undefined : currentType);

  // Allow unauthenticated users to see the page (content or empty state)
  if (!user && items.length > 0) {
    redirect(`/${locale}/login`);
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      {/* Page Header — amber-themed for Opportunities to differentiate from Webinars */}
      <header className="mb-10">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 ring-1 ring-amber-200">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              {t("title")}
            </p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight text-gray-900">
              {t("subtitle")}
            </h1>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Link
              className={`inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold transition-all duration-200 ${
                currentType === filter
                  ? "bg-neon-600 text-white shadow-md shadow-emerald-200"
                  : "border border-gray-200 bg-dark-100 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
              href={`/${locale}/opportunities?type=${filter}`}
              key={filter}
            >
              {t(`filters.${filter}`)}
            </Link>
          ))}
        </div>
      </header>

      {/* Admin Form */}
      {user?.role === "ADMIN" ? (
        <div className="mb-8">
          <OpportunityForm />
        </div>
      ) : null}

      {/* Opportunities Cards */}
      {items.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {items.map((item) => (
            <article
              className={`group relative rounded-2xl border bg-dark-100 shadow-sm transition-all duration-200 hover:shadow-lg ${
                item.expired ? "border-gray-100 opacity-75" : "border-gray-100"
              }`}
              key={item.id}
            >
              <div className="p-6">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-neon-700 transition-colors">
                    {item.title}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      item.expired
                        ? "bg-red-50 text-red-600"
                        : TYPE_COLORS[item.type] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {item.expired ? t("expired") : t(`types.${item.type}`)}
                  </span>
                </div>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.description}</p>

                {/* Deadline */}
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="font-medium">
                    {t("deadline")}: {formatDate(item.deadline, locale)}
                  </span>
                </div>

                {/* Action Link */}
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-gray-50 pt-4">
                  <a
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold transition ${
                      item.expired
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-neon-600 hover:text-neon-700"
                    }`}
                    href={item.externalUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t("openOpportunity")}
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                  {user?.role === "ADMIN" ? (
                    <DeleteContentButton id={item.id} kind="opportunity" />
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-dark-100 py-20 shadow-sm">
          <svg className="h-16 w-16 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-4 text-base font-medium text-gray-400">No opportunities found.</p>
          <p className="mt-1 text-sm text-gray-300">Try adjusting your filter or check back later.</p>
        </div>
      )}
    </section>
  );
}
