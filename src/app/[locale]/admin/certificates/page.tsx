import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { AllCertificates } from "@/components/admin/all-certificates";
import { listAllCertificates } from "@/lib/platform/certificates";
import { can, getAccessControl } from "@/lib/security/permissions";

type AdminCertificatesPageProps = {
  params: { locale: string };
};

export const dynamic = "force-dynamic";

/**
 * Every certificate in one place, and a form to issue one for a course that
 * has no class on the platform. Certificates for a platform class are still
 * issued from that class's page, which lists its students.
 */
export default async function AdminCertificatesPage({ params }: AdminCertificatesPageProps) {
  const access = await getAccessControl();

  if (!access) {
    redirect(`/${params.locale}/login`);
  }

  if (!access.isAdmin || !can(access, "classes.view")) {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "certificates" });
  const rows = await listAllCertificates();
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kabul" });

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <h1 className="text-3xl font-black text-ink-main sm:text-4xl">{t("pageTitle")}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t("pageSubtitle")}</p>
      </header>

      <AllCertificates
        canEdit={can(access, "classes.edit")}
        certificates={rows.map((row) => ({
          code: row.code,
          kind: row.kind,
          recipientName: row.recipientName,
          className: row.className,
          issued: date(row.issuedAt),
          revoked: Boolean(row.revokedAt),
        }))}
        locale={params.locale}
      />
    </section>
  );
}
