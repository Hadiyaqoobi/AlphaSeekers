import { getTranslations } from "next-intl/server";

import { LibraryComingSoon } from "@/components/coming-soon/library-coming-soon";
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

  const query = searchParams.q ?? "";
  const items = await listLibraryResources(query);

  // Show coming soon for everyone when no content exists
  if (items.length === 0 && !user?.role?.includes("ADMIN")) {
    return <LibraryComingSoon />;
  }

  // Library resources are public-by-design (BRD §5.4): downloads and
  // external links are non-sensitive. Anonymous users can browse and
  // download — no auth gate needed (Antigravity 2026-04-26 PUB-08).

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      {/* Page Header */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-400">
          {t("title")}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-main">
          {t("subtitle")}
        </h1>

        {/* Search Bar */}
        {items.length > 0 && (
          <form className="mt-6 flex gap-3" method="GET">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint"
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
                className="min-h-12 w-full rounded-xl border border-white/10 bg-dark-200 py-3 pl-12 pr-4 text-sm text-ink-main placeholder:text-ink-faint focus:border-neon-500 focus:outline-none focus:ring-2 focus:ring-neon-500/20"
                defaultValue={query}
                name="q"
                placeholder={t("searchPlaceholder")}
              />
            </div>
            <button
              className="inline-flex min-h-12 items-center rounded-xl bg-neon-600 px-6 text-sm font-semibold text-black transition hover:bg-neon-500 focus:outline-none focus:ring-2 focus:ring-neon-500/20"
              type="submit"
            >
              {t("searchButton")}
            </button>
          </form>
        )}
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
              className="group flex flex-col rounded-2xl border border-white/5 bg-dark-100 transition-all duration-200 hover:shadow-lg"
              key={item.id}
            >
              <div className="flex flex-1 flex-col p-6">
                {/* File Icon + Category */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-500/10">
                    <svg
                      className="h-5 w-5 text-neon-400"
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
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-ink-soft">
                    {item.category}
                  </span>
                </div>

                {/* Title & Author */}
                <h2 className="text-lg font-bold text-ink-main group-hover:text-neon-300 transition-colors">
                  {item.title}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {item.author ?? t("unknownAuthor")}
                </p>

                {/* File Size */}
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
                  <span>
                    {item.fileSize
                      ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB`
                      : t("fileSizeUnavailable")}
                  </span>
                  <DataCostBadge fileSize={item.fileSize} />
                </div>

                {/* Actions */}
                <div className="mt-auto pt-5 border-t border-white/5">
                  <div className="flex flex-wrap gap-2">
                    {item.fileUrl ? (
                      <>
                        <a
                          className="inline-flex items-center gap-1.5 rounded-lg bg-neon-600 px-4 py-2 text-xs font-semibold text-black transition hover:bg-neon-500"
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
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-ink-faint">
                        {t("fileUnavailable")}
                      </span>
                    )}
                    {item.externalUrl ? (
                      <a
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-dark-100 px-4 py-2 text-xs font-semibold text-ink-soft transition hover:bg-white/5"
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
        <LibraryComingSoon />
      )}
    </section>
  );
}
