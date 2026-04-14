import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { LogoTicker } from "@/components/landing/LogoTicker";
import { WorkflowPipeline } from "@/components/landing/WorkflowPipeline";
import { FeatureTabs } from "@/components/landing/FeatureTabs";
import { MissionSection } from "@/components/landing/MissionSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AIShowcase } from "@/components/landing/AIShowcase";
import { CTABanner } from "@/components/landing/CTABanner";
import { Footer } from "@/components/landing/Footer";
import { getSessionUser } from "@/lib/security/session";

type HomePageProps = { params: { locale: string } };

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "home" });
  const navT = await getTranslations({ locale, namespace: "nav" });
  const user = await getSessionUser();
  const signedIn = Boolean(user);

  return (
    <div className="landing-page">
      <Navbar
        locale={locale}
        signedIn={signedIn}
        loginLabel={navT("login")}
        registerLabel={navT("register")}
      />
      <Hero
        locale={locale}
        signedIn={signedIn}
        studentLabel={t("hero.imStudent")}
        teacherLabel={t("hero.imTeacher")}
      />
      <LogoTicker />
      <WorkflowPipeline />
      <FeatureTabs />
      <MissionSection />
      <HowItWorks />
      <AIShowcase />
      <CTABanner
        locale={locale}
        signedIn={signedIn}
        registerLabel={navT("register")}
        loginLabel={navT("login")}
      />
      <Footer locale={locale} signedIn={signedIn} />
    </div>
  );
}
