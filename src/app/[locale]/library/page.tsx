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
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("title")}</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900 sm:text-4xl">{t("subtitle")}</h1>

        <form className="mt-4 flex flex-wrap gap-2" method="GET">
          <input
            className="field min-w-[220px] flex-1"
            defaultValue={query}
            name="q"
            placeholder={t("searchPlaceholder")}
          />
          <button className="btn-primary" type="submit">
            {t("searchButton")}
          </button>
        </form>
      </header>

      {user?.role === "ADMIN" ? <LibraryForm /> : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <article className="panel panel-strong p-4" key={item.id}>
            <h2 className="text-xl font-black text-slate-900">{item.title}</h2>
            <p className="mt-1 text-sm text-slate-700">{item.author ?? t("unknownAuthor")}</p>
            <p className="text-xs text-slate-600">{item.category}</p>
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
              {item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB` : t("fileSizeUnavailable")}
              <DataCostBadge fileSize={item.fileSize} />
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.fileUrl ? (
                <div className="flex items-center gap-2">
                  <a
                    className="btn-secondary"
                    href={item.fileUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t("downloadPdf")}
                  </a>
                  <SaveOfflineButton fileUrl={item.fileUrl} title={item.title} />
                </div>
              ) : (
                <span className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-500">
                  {t("fileUnavailable")}
                </span>
              )}
              {item.externalUrl ? (
                <a className="btn-secondary" href={item.externalUrl} rel="noreferrer" target="_blank">
                  {t("openExternalLink")}
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
