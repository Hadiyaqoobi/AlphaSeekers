import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SiteSettingsForm } from "@/components/admin/site-settings-form";
import { getSiteSettings } from "@/lib/platform/site-settings";
import { getSessionUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

type AdminSettingsPageProps = {
  params: { locale: string };
};

export default async function AdminSettingsPage({ params }: AdminSettingsPageProps) {
  const user = await getSessionUser();
  if (!user) redirect(`/${params.locale}/login`);
  if (user.role !== "ADMIN") redirect(`/${params.locale}/dashboard`);

  const t = await getTranslations({
    locale: params.locale,
    namespace: "siteSettings",
  });
  const settings = await getSiteSettings();

  return (
    <section className="mx-auto max-w-3xl px-6 py-10 lg:px-8">
      <header className="mb-8">
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#00E676" }}
        >
          {t("title")}
        </p>
        <h1
          className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ color: "#E8EEF2" }}
        >
          {t("title")}
        </h1>
        <p className="mt-2 text-base" style={{ color: "#8AA4B8" }}>
          {t("subtitle")}
        </p>
      </header>

      <SiteSettingsForm initial={settings} />
    </section>
  );
}
