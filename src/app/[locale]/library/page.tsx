import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { DataCostBadge } from "@/components/data-cost-badge";
import { LibraryForm } from "@/components/forms/library-form";
import { SaveOfflineButton } from "@/components/save-offline-button";
import { listLibraryResources } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type LibraryPageProps = {
  params: { locale: string };
  searchParams: { q?: string };
};

export default async function LibraryPage({ params, searchParams }: LibraryPageProps) {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "library" });
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (!user.approved && user.role !== "ADMIN") {
    redirect(`/${locale}/pending-approval`);
  }

  const query = searchParams.q ?? "";
  const items = await listLibraryResources(query);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      {/* Page Header */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
          {t("title")}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
          {t("subtitle")}
        </h1>

        {/* Search Bar */}
        <form className="mt-6 flex gap-3" method="GET">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              className="min-h-12 w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              defaultValue={query}
              name="q"
              placeholder={t("searchPlaceholder")}
            />
          </div>
          <button
            className="inline-flex min-h-12 items-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            type="submit"
          >
            {t("searchButton")}
          </button>
        </form>
      </header>

      {/* Admin Form */}
      {user?.role === "ADMIN" ? (
        <div className="mb-8">
          <LibraryForm />
        </div>
      ) : null}

      {/* Resource Cards */}
      {items.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              className="group flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:shadow-lg"
              key={item.id}
            >
              <div className="flex flex-1 flex-col p-6">
                {/* File Icon + Category */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                    <svg
                      className="h-5 w-5 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                    {item.category}
                  </span>
                </div>

                {/* Title & Author */}
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {item.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {item.author ?? t("unknownAuthor")}
                </p>

                {/* File Size */}
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <span>
                    {item.fileSize
                      ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB`
                      : t("fileSizeUnavailable")}
                  </span>
                  <DataCostBadge fileSize={item.fileSize} />
                </div>

                {/* Actions */}
                <div className="mt-auto pt-5 border-t border-gray-50">
                  <div className="flex flex-wrap gap-2">
                    {item.fileUrl ? (
                      <>
                        <a
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                          href={item.fileUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {t("downloadPdf")}
                        </a>
                        <SaveOfflineButton fileUrl={item.fileUrl} title={item.title} />
                      </>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-400">
                        {t("fileUnavailable")}
                      </span>
                    )}
                    {item.externalUrl ? (
                      <a
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50"
                        href={item.externalUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {t("openExternalLink")}
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-20 shadow-sm">
          <svg
            className="h-16 w-16 text-gray-200"
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            viewBox="0 0 24 24"
          >
            <path
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-4 text-base font-medium text-gray-400">
            {query ? "No resources matched your search." : "No resources available yet."}
          </p>
          <p className="mt-1 text-sm text-gray-300">
            {query ? "Try a different search term." : "Check back soon for new content."}
          </p>
        </div>
      )}
    </section>
  );
}
