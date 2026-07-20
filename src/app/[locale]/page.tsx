import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/security/session";
import { LandingShell } from "@/components/landing/LandingShell";

type HomePageProps = { params: { locale: string } };

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = params;

  // Logged-in users belong in the app, not on the public marketing page —
  // send them to their dashboard (avoids the landing rendering inside the
  // authenticated sidebar / double navigation).
  const user = await getSessionUser();
  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations({ locale, namespace: "home" });
  const navT = await getTranslations({ locale, namespace: "nav" });

  return (
    <LandingShell
      locale={locale}
      signedIn={false}
      loginLabel={navT("login")}
      registerLabel={navT("register")}
      studentLabel={t("hero.imStudent")}
      teacherLabel={t("hero.imTeacher")}
    />
  );
}
