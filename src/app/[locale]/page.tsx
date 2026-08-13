import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/security/session";
import { getSiteSettings } from "@/lib/platform/site-settings";
import { getLandingHighlights } from "@/lib/platform/landing-highlights";
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

  // settings: contact details for the footer, from admin Site Settings.
  // highlights: what is open right now, so a visitor arriving from a poster can
  // see the advertised class exists without having to sign up first.
  const [settings, highlights] = await Promise.all([getSiteSettings(), getLandingHighlights()]);

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
      highlights={highlights}
    />
  );
}
