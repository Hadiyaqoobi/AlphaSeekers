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
import { Footer, type SocialLinks } from '@/components/landing/Footer';

type Props = {
  locale: string;
  signedIn: boolean;
  loginLabel: string;
  registerLabel: string;
  studentLabel: string;
  teacherLabel: string;
  socialLinks?: SocialLinks;
  contactEmail?: string | null;
};

/**
 * LandingShell renders the full landing page. All framer-motion elements
 * use `initial` props that render specific inline styles (e.g. opacity:0)
 * on BOTH server and client first render — preventing hydration mismatches.
 * Animations only run after mount via `animate` + `viewport` triggers.
 */
export function LandingShell(props: Props) {
  return (
    <div className="landing-page">
      <Navbar locale={props.locale} signedIn={props.signedIn} loginLabel={props.loginLabel} registerLabel={props.registerLabel} />
      <Hero locale={props.locale} signedIn={props.signedIn} studentLabel={props.studentLabel} teacherLabel={props.teacherLabel} />
      <LogoTicker />
      <WorkflowPipeline />
      <FeatureTabs />
      <MissionSection />
      <HowItWorks />
      <AIShowcase />
      <CTABanner locale={props.locale} signedIn={props.signedIn} registerLabel={props.registerLabel} loginLabel={props.loginLabel} />
      <Footer
        locale={props.locale}
        signedIn={props.signedIn}
        socialLinks={props.socialLinks}
        contactEmail={props.contactEmail}
      />
    </div>
  );
}
