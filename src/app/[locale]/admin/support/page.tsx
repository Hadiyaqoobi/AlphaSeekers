import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { TicketQueue } from "@/components/admin/ticket-queue";
import { getAccessControl, can } from "@/lib/security/permissions";

type AdminSupportPageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({ params }: AdminSupportPageProps) {
  const access = await getAccessControl();

  if (!access) {
    redirect(`/${params.locale}/login`);
  }

  if (!can(access, "support.view")) {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "support" });

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-400">{t("kicker")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-main sm:text-4xl">{t("queueTitle")}</h1>
        <p className="mt-2 text-base text-ink-soft">{t("queueSubtitle")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/admin/classes`}
          >
            {t("backToAdmin")}
          </Link>
        </div>
      </header>

      <TicketQueue canManage={can(access, "support.manage")} canCreate={can(access, "support.create")} locale={params.locale} />
    </section>
  );
}
