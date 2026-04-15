'use client';

import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { LogoTicker } from '@/components/landing/LogoTicker';
import { WorkflowPipeline } from '@/components/landing/WorkflowPipeline';
import { FeatureTabs } from '@/components/landing/FeatureTabs';
import { MissionSection } from '@/components/landing/MissionSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { AIShowcase } from '@/components/landing/AIShowcase';
import { CTABanner } from '@/components/landing/CTABanner';
import { Footer } from '@/components/landing/Footer';

type LandingContentProps = {
  locale: string;
  signedIn: boolean;
  loginLabel: string;
  registerLabel: string;
  studentLabel: string;
  teacherLabel: string;
};

export default function LandingContent({
  locale,
  signedIn,
  loginLabel,
  registerLabel,
  studentLabel,
  teacherLabel,
}: LandingContentProps) {
  return (
    <div className="landing-page">
      <Navbar locale={locale} signedIn={signedIn} loginLabel={loginLabel} registerLabel={registerLabel} />
      <Hero locale={locale} signedIn={signedIn} studentLabel={studentLabel} teacherLabel={teacherLabel} />
      <LogoTicker />
      <WorkflowPipeline />
      <FeatureTabs />
      <MissionSection />
      <HowItWorks />
      <AIShowcase />
      <CTABanner locale={locale} signedIn={signedIn} registerLabel={registerLabel} loginLabel={loginLabel} />
      <Footer locale={locale} signedIn={signedIn} />
    </div>
  );
}
