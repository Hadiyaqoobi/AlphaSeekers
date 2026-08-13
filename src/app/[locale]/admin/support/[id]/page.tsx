import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { TicketDetail } from "@/components/admin/ticket-detail";
import { getTicketById } from "@/lib/platform/tickets";
import { getAccessControl, can } from "@/lib/security/permissions";

type TicketPageProps = {
  params: { locale: string; id: string };
};

export const dynamic = "force-dynamic";

export default async function AdminTicketPage({ params }: TicketPageProps) {
  const access = await getAccessControl();

  if (!access) {
    redirect(`/${params.locale}/login`);
  }

  if (!can(access, "support.view")) {
    redirect(`/${params.locale}/dashboard`);
  }

  const ticket = await getTicketById(params.id);
  if (!ticket) {
    notFound();
  }

  const t = await getTranslations({ locale: params.locale, namespace: "support" });

  return (
    <section className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
      <Link
        className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
        href={`/${params.locale}/admin/support`}
      >
        {t("backToQueue")}
      </Link>

      <TicketDetail
        canManage={can(access, "support.manage")}
        currentUserId={access.userId}
        ticket={ticket}
      />
    </section>
  );
}
