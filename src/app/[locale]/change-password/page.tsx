import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PasswordChangeForm } from "@/components/profile/password-change-form";
import { DirArrow } from "@/components/ui/dir-arrow";
import { getSessionUser } from "@/lib/security/session";
import { loginHref } from "@/lib/ui/safe-next";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { locale: string };
};

/**
 * Dedicated change-password screen. Employees created by the super console
 * start with a temporary password and are nudged here by a persistent banner.
 * Reuses the shared PasswordChangeForm (which posts to /api/me/password and,
 * on success, clears the mustChangePassword flag server-side).
 */
export default async function ChangePasswordPage({ params }: PageProps) {
  const { locale } = params;
  const user = await getSessionUser();
  if (!user) {
    redirect(loginHref(locale, `/${locale}/change-password`));
  }

  const t = await getTranslations({ locale, namespace: "profile" });

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-main">{t("changePassword.title")}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t("changePassword.subtitle")}
        </p>
      </div>

      <PasswordChangeForm />

      <div className="mt-6">
        <Link
          href={`/${locale}/dashboard`}
          className="text-sm font-medium text-neon-600 transition-colors hover:text-neon-700"
        >
          <DirArrow back /> {t("actions.backToDashboard")}
        </Link>
      </div>
    </div>
  );
}
