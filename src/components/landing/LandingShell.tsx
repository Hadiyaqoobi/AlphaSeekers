'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

type Props = {
  locale: string;
  signedIn: boolean;
  loginLabel: string;
  registerLabel: string;
  studentLabel: string;
  teacherLabel: string;
};

/**
 * LandingShell renders a static SSR placeholder first (no framer-motion),
 * then swaps in the full animated version after the client hydrates.
 * This prevents the hydration mismatch caused by framer-motion injecting
 * data-* attributes and style transforms that differ between server & client.
 */
export function LandingShell(props: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before mount: render a static, SSR-safe version that includes the key
  // text content for SEO and smoke-test assertions.
  if (!mounted) {
    return (
      <div className="landing-page">
        {/* Static navbar placeholder (no framer-motion) */}
        <header className="landing-nav fixed top-0 left-0 right-0 z-50 h-20 bg-transparent border-b border-transparent">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 h-full flex items-center justify-between">
            <Link href={`/${props.locale}`} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-bold text-white">
                A
              </span>
              <span className="hidden sm:inline text-xl font-extrabold tracking-tight text-white" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>
                AlphaSeekers
              </span>
            </Link>
            <nav className="hidden lg:flex lg:items-center lg:gap-1">
              <Link href={`/${props.locale}`} className="rounded-lg px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10">Home</Link>
              <Link href={`/${props.locale}#programs`} className="rounded-lg px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10">Programs</Link>
              <Link href={`/${props.locale}#how-it-works`} className="rounded-lg px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10">How It Works</Link>
            </nav>
            <div className="hidden lg:flex lg:items-center lg:gap-3">
              {!props.signedIn && (
                <Link href={`/${props.locale}/login`} className="rounded-lg px-4 py-2.5 text-sm font-medium text-white/70">{props.loginLabel}</Link>
              )}
              <Link href={props.signedIn ? `/${props.locale}/dashboard` : `/${props.locale}/register`} className="inline-flex items-center gap-2 bg-land-green-600 text-white rounded-xl px-6 py-2.5 text-sm font-semibold">
                {props.signedIn ? 'Dashboard' : props.registerLabel}
              </Link>
            </div>
          </div>
        </header>

        {/* Static hero with key SEO text */}
        <section className="relative min-h-screen overflow-hidden bg-land-dark">
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center min-h-screen">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2.5 rounded-full bg-land-green-600/15 border border-land-green-500/25 px-5 py-2 text-sm font-medium text-land-green-300">
                <span className="flex h-2 w-2 rounded-full bg-land-green-400" />
                Free education for Afghan students
              </span>
              <h1 className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.05]" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>
                Every Afghan student{' '}<br className="hidden sm:block" />
                deserves to{' '}<span className="text-land-green-400">learn</span>
              </h1>
              <p className="mt-7 text-lg lg:text-xl text-white/55 max-w-xl leading-relaxed">
                Free online classes for Afghan students, taught by volunteer teachers from around the world. Powered by AI. Built for low-bandwidth connections.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link href={props.signedIn ? `/${props.locale}/dashboard` : `/${props.locale}/register`} className="group inline-flex items-center justify-center gap-3 py-4 px-8 rounded-xl bg-land-green-600 text-white text-base font-semibold">
                  {props.signedIn ? 'Dashboard' : props.studentLabel}
                </Link>
                <Link href={props.signedIn ? `/${props.locale}/teacher/availability` : `/${props.locale}/register`} className="inline-flex items-center justify-center gap-3 py-4 px-8 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white text-base font-semibold">
                  {props.teacherLabel}
                </Link>
              </div>
            </div>
            {/* Platform mockup placeholder */}
            <div className="relative mt-16 lg:mt-0">
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/[0.08] bg-[#0f1419] min-h-[280px]" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  // After mount: render the full animated version with framer-motion
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
      <Footer locale={props.locale} signedIn={props.signedIn} />
    </div>
  );
}
