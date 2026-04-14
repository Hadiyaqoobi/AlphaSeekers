'use client';

import Link from 'next/link';
import { ScrollReveal } from './ScrollReveal';

type CTABannerProps = {
  locale: string;
  signedIn: boolean;
  registerLabel: string;
  loginLabel: string;
};

export function CTABanner({ locale, signedIn, registerLabel, loginLabel }: CTABannerProps) {
  const ctaHref = signedIn ? `/${locale}/dashboard` : `/${locale}/register`;

  return (
    <section className="relative w-full py-24 bg-gradient-to-br from-land-green-900 to-land-green-950 overflow-hidden">
      {/* Soft glow */}
      <div
        className="absolute blur-[120px] rounded-full"
        style={{ width: 500, height: 500, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(29,185,100,0.08) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center">
            <h2
              className="text-4xl lg:text-5xl font-bold text-white tracking-tight"
              style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
            >
              The classroom of the future is free
            </h2>
            <p className="text-lg text-white/55 mt-4 max-w-lg mx-auto">
              Whether you want to learn or teach, there&apos;s a place for you.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-white text-land-green-700 text-base font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 active:translate-y-0"
              >
                {signedIn ? 'Go to dashboard' : 'Start learning'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </Link>
              {!signedIn && (
                <Link
                  href={`/${locale}/register`}
                  className="inline-flex items-center px-8 py-4 rounded-xl border-2 border-white/25 text-white text-base font-semibold transition-all duration-200 hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Become a volunteer
                </Link>
              )}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
