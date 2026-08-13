import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/security/session";
import { getSiteSettings } from "@/lib/platform/site-settings";
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

  // Contact details live in admin Site Settings. Without this the footer
  // renders no social icons and no email, however carefully they are filled in.
  const settings = await getSiteSettings();

  return (
    <LandingShell
      locale={locale}
      signedIn={false}
      loginLabel={navT("login")}
      registerLabel={navT("register")}
      studentLabel={t("hero.imStudent")}
      teacherLabel={t("hero.imTeacher")}
      socialLinks={{
        instagram: settings.instagramUrl,
        facebook: settings.facebookUrl,
        twitter: settings.twitterUrl,
        linkedin: settings.linkedinUrl,
        youtube: settings.youtubeUrl,
        telegram: settings.telegramUrl,
        whatsapp: settings.whatsappUrl,
      }}
      contactEmail={settings.contactEmail}
    />
  );
}
