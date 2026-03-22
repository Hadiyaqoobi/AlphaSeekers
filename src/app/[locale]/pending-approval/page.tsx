import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getSessionUser } from "@/lib/security/session";

type PendingApprovalPageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage({ params }: PendingApprovalPageProps) {
  const user = await getSessionUser();
  const t = await getTranslations({ locale: params.locale, namespace: "pending" });

  if (user?.approved) {
    redirect(`/${params.locale}/dashboard`);
  }

  return (
    <section className="mx-auto w-full max-w-xl space-y-4">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900 sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-700">
          {t("body")}
        </p>
      </header>

      <section className="panel panel-strong space-y-3 p-5 sm:p-6">
        <p className="text-sm text-slate-700">
          {t("note")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-primary" href={`/${params.locale}/login`}>
            {t("goToLogin")}
          </Link>
          <Link className="btn-secondary" href={`/${params.locale}`}>
            {t("home")}
          </Link>
        </div>
      </section>
    </section>
  );
}
