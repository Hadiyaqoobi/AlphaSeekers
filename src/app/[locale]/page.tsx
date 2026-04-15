import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/security/session";
import { LandingShell } from "@/components/landing/LandingShell";

type HomePageProps = { params: { locale: string } };

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "home" });
  const navT = await getTranslations({ locale, namespace: "nav" });
  const user = await getSessionUser();
  const signedIn = Boolean(user);

  return (
    <LandingShell
      locale={locale}
      signedIn={signedIn}
      loginLabel={navT("login")}
      registerLabel={navT("register")}
      studentLabel={t("hero.imStudent")}
      teacherLabel={t("hero.imTeacher")}
    />
  );
}
