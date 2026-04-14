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
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      {/* Page Header */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
          {t("title")}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900">
          {t("userApprovalsTitle")}
        </h1>
        <p className="mt-2 text-base text-gray-500">
          {t("userApprovalsSubtitle")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow-md"
            href={`/${params.locale}/admin/classes`}
          >
            <svg className="mr-2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("backToAdmin")}
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:shadow-md"
            href={`/${params.locale}/dashboard`}
          >
            {t("dashboard")}
          </Link>
        </div>
      </header>

      {/* User Approvals Component */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <UserApprovals />
      </div>
    </section>
  );
}
