import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { formatDateTime } from "@/lib/format-date";
import { WebinarForm } from "@/components/forms/webinar-form";
import { WebinarRegisterButton } from "@/components/forms/webinar-register-button";
import { listRegisteredWebinarIds, listWebinars } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type WebinarsPageProps = {
  params: { locale: string };
};

export default async function WebinarsPage({ params }: WebinarsPageProps) {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "webinars" });
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (!user.approved && user.role !== "ADMIN") {
    redirect(`/${locale}/pending-approval`);
  }

  const items = await listWebinars();
  const registeredIds = user ? new Set(await listRegisteredWebinarIds(user.id)) : new Set<string>();

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("title")}</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900 sm:text-4xl">{t("subtitle")}</h1>
      </header>

      {user?.role === "ADMIN" ? <WebinarForm /> : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <article className="panel panel-strong p-4" key={item.id}>
            <h2 className="text-xl font-black text-slate-900">{item.title}</h2>
            <p className="mt-1 text-sm text-slate-700">{item.description}</p>
            <p className="mt-2 text-xs font-semibold text-slate-600">{formatDateTime(item.startsAt, locale)}</p>
            {user && (user.role === "ADMIN" || (user.approved && registeredIds.has(item.id))) ? (
              <a className="mt-2 inline-flex text-sm font-semibold text-sky-700 underline-offset-2 hover:underline" href={item.meetLink} rel="noreferrer" target="_blank">
                {t("openJoinLink")}
              </a>
            ) : (
              <p className="mt-2 text-sm text-slate-600">{t("registerPrompt")}</p>
            )}

            {user ? (
              registeredIds.has(item.id) ? (
                <div className="mt-3">
                  <span className="badge-pill">{t("registeredBadge")}</span>
                </div>
              ) : (
                <div className="mt-3">
                  <WebinarRegisterButton webinarId={item.id} />
                </div>
              )
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
