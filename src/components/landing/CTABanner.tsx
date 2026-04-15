'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

type CTABannerProps = { locale: string; signedIn: boolean; registerLabel: string; loginLabel: string };

export function CTABanner({ locale, signedIn }: CTABannerProps) {
  const t = useTranslations('landing');
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { rootMargin: '-60px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const ctaHref = signedIn ? `/${locale}/dashboard` : `/${locale}/register`;
  const words = t('ctaBanner.headline').split(' ');

  return (
    <section className="relative w-full py-24 bg-gradient-to-br from-land-green-900 to-land-green-950 overflow-hidden" ref={ref}>
      <div className="absolute blur-[120px] rounded-full" style={{ width: 500, height: 500, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(29,185,100,0.08) 0%, transparent 70%)', animation: 'glow-pulse 4s ease-in-out infinite' }} aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>
            {words.map((word, i) => (
              <span key={i} className="inline-block mr-[0.3em]" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(15px)', transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s` }}>{word}</span>
            ))}
          </h2>
          <p className="text-lg text-white/55 mt-4 max-w-lg mx-auto" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(15px)', transition: 'all 0.6s 0.5s' }}>
            {t('ctaBanner.subtitle')}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(15px)', transition: 'all 0.6s 0.7s' }}>
            <Link href={ctaHref} className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-white text-land-green-700 text-base font-bold transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/25 active:translate-y-0">
              {signedIn ? t('ctaBanner.ctaDashboard') : t('ctaBanner.ctaStudent')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
            </Link>
            {!signedIn && (
              <Link href={`/${locale}/register`} className="inline-flex items-center px-8 py-4 rounded-xl border-2 border-white/25 text-white text-base font-semibold transition-all duration-200 hover:bg-white/10 hover:-translate-y-1 active:translate-y-0">
                {t('ctaBanner.ctaVolunteer')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
