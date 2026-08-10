import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { UserApprovals } from "@/components/admin/user-approvals";
import { getAccessControl, can } from "@/lib/security/permissions";

type AdminUsersPageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ params }: AdminUsersPageProps) {
  const access = await getAccessControl();

  if (!access) {
    redirect(`/${params.locale}/login`);
  }

  if (!can(access, "users.view")) {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "admin" });

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      {/* Page Header */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-400">
          {t("title")}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-main">
          {t("manageUsersTitle")}
        </h1>
        <p className="mt-2 text-base text-ink-soft">
          {t("manageUsersSubtitle")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/admin/classes`}
          >
            <svg className="mr-2 h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("backToAdmin")}
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/dashboard`}
          >
            {t("dashboard")}
          </Link>
        </div>
      </header>

      {/* User Approvals Component */}
      <div className="rounded-2xl border border-white/5 bg-dark-100">
        <UserApprovals />
      </div>
    </section>
  );
}
