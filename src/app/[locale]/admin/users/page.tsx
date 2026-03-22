import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { UserApprovals } from "@/components/admin/user-approvals";
import { getSessionUser } from "@/lib/security/session";

type AdminUsersPageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ params }: AdminUsersPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${params.locale}/login`);
  }

  if (user.role !== "ADMIN") {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "admin" });

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("title")}</p>
        <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("userApprovalsTitle")}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {t("userApprovalsSubtitle")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${params.locale}/admin/classes`}>
            {t("backToAdmin")}
          </Link>
          <Link className="btn-secondary" href={`/${params.locale}/dashboard`}>
            {t("dashboard")}
          </Link>
        </div>
      </header>

      <UserApprovals />
    </section>
  );
}
