'use client';

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function HowItWorks() {
  const t = useTranslations('landing');

  const steps = [
    { num: t('howItWorks.steps.0.num'), title: t('howItWorks.steps.0.title'), desc: t('howItWorks.steps.0.desc') },
    { num: t('howItWorks.steps.1.num'), title: t('howItWorks.steps.1.title'), desc: t('howItWorks.steps.1.desc') },
    { num: t('howItWorks.steps.2.num'), title: t('howItWorks.steps.2.title'), desc: t('howItWorks.steps.2.desc') },
  ];
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { rootMargin: '-60px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="relative w-full py-20 lg:py-28 overflow-hidden" id="how-it-works" ref={ref}>
      {/* Section ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(0,230,118,0.06)_0%,transparent_60%)] pointer-events-none" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(30px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)' }}>
          <p className="text-sm uppercase tracking-[0.15em] text-neon-500 font-medium mb-4">{t('howItWorks.kicker')}</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t('howItWorks.title')}</h2>
          <p className="text-lg text-white/45 max-w-xl mx-auto">{t('howItWorks.subtitle')}</p>
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Steps — LEFT */}
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-start gap-5" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(20px)', transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.3}s` }}>
                <div className="flex flex-col items-center">
                  <div
                    className="w-10 h-10 rounded-full bg-neon-500 text-dark-DEFAULT flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-[0_0_16px_rgba(0,230,118,0.4)]"
                    style={{ transform: inView ? 'scale(1)' : 'scale(0)', transition: `transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.2 + i * 0.3}s` }}
                  >
                    {step.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="w-px h-12 bg-gradient-to-b from-neon-500/40 to-transparent mt-2 origin-top"
                      style={{ transform: inView ? 'scaleY(1)' : 'scaleY(0)', transition: `transform 0.4s ease ${0.4 + i * 0.3}s` }}
                    />
                  )}
                </div>
                <div className="pb-8" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.5s ${0.35 + i * 0.3}s` }}>
                  <h3 className="text-lg font-semibold text-white mt-1.5">{step.title}</h3>
                  <p className="text-base text-white/45 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Phone mockup — RIGHT (fully dark themed) */}
          <div className="mt-12 lg:mt-0 flex justify-center" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateX(60px) rotate(3deg)', transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s' }}>
            <div className="relative">
              {/* Glow behind phone */}
              <div className="absolute -inset-10 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,230,118,0.15)_0%,transparent_70%)] pointer-events-none" aria-hidden="true" />

              {/* Phone shell */}
              <div className="relative w-[280px] rounded-[2.5rem] border-[3px] border-white/10 bg-dark-200 p-2 shadow-[0_0_50px_rgba(0,230,118,0.12)]">
                {/* Notch */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[100px] h-[24px] bg-dark-DEFAULT rounded-b-2xl z-10" />

                {/* Screen */}
                <div className="relative bg-dark-DEFAULT rounded-[2rem] overflow-hidden aspect-[9/19.5]">
                  {/* Status bar */}
                  <div className="h-9 flex items-end justify-between px-6 pb-1 pt-2">
                    <span className="text-[10px] font-semibold text-white/60">9:41</span>
                    <div className="flex gap-1 items-center">
                      <div className="w-3.5 h-2 border border-white/30 rounded-sm relative">
                        <div className="absolute inset-[1px] right-[2px] bg-white/30 rounded-[1px]" />
                      </div>
                    </div>
                  </div>

                  {/* App header */}
                  <div className="px-5 pt-3 pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo/mark-light.svg" alt="" aria-hidden="true" width={28} height={28} className="rounded-lg shadow-[0_0_10px_rgba(0,230,118,0.4)]" />
                      <span className="text-xs font-bold text-white">AlphaSeekers</span>
                    </div>
                    <p className="text-[10px] text-white/40">{t('howItWorks.mockup.welcomeBack')}</p>
                  </div>

                  {/* Stat cards */}
                  <div className="px-5 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-dark-100 rounded-xl p-3 border border-white/[0.06]">
                        <p className="text-[9px] text-white/40">{t('howItWorks.mockup.classes')}</p>
                        <p className="text-sm font-bold text-white">3</p>
                      </div>
                      <div className="bg-dark-100 rounded-xl p-3 border border-white/[0.06]">
                        <p className="text-[9px] text-white/40">{t('howItWorks.mockup.today')}</p>
                        <p className="text-sm font-bold text-neon-400">{t('howItWorks.mockup.todayValue')}</p>
                      </div>
                    </div>

                    {/* Session cards */}
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="bg-dark-100 rounded-xl p-3 border border-white/[0.06]">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-semibold text-white">{t(`howItWorks.mockup.mockClassNames.${j}`)}</p>
                            <p className="text-[9px] text-white/40 mt-0.5">{t(`howItWorks.mockup.mockTimes.${j}`)}</p>
                          </div>
                          <div className="w-7 h-7 rounded-lg bg-neon-500/15 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-neon-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom glow divider */}
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 mt-20">
        <div className="h-px bg-gradient-to-r from-transparent via-neon-500/30 to-transparent" />
      </div>
    </section>
  );
}
