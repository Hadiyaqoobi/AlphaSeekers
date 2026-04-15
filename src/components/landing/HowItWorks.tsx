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
    <section className="w-full py-24 bg-land-sage" id="how-it-works" ref={ref}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16 lg:text-left" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(30px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)' }}>
          <p className="text-land-green-600 text-sm font-semibold uppercase tracking-[0.15em] mb-4">{t('howItWorks.kicker')}</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t('howItWorks.title')}</h2>
          <p className="text-lg text-gray-500 max-w-lg">{t('howItWorks.subtitle')}</p>
        </div>
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-start gap-5" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateY(20px)', transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.3}s` }}>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-land-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ transform: inView ? 'scale(1)' : 'scale(0)', transition: `transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.2 + i * 0.3}s` }}>
                    {step.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-[2px] h-12 border-l-2 border-dashed border-gray-200 ml-0 origin-top" style={{ transform: inView ? 'scaleY(1)' : 'scaleY(0)', transition: `transform 0.4s ease ${0.4 + i * 0.3}s` }} />
                  )}
                </div>
                <div className="pb-8" style={{ opacity: inView ? 1 : 0, transition: `opacity 0.5s ${0.35 + i * 0.3}s` }}>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1.5">{step.title}</h3>
                  <p className="text-base text-gray-500 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 lg:mt-0 flex justify-center" style={{ opacity: inView ? 1 : 0, transform: inView ? 'none' : 'translateX(60px) rotate(3deg)', transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.5s' }}>
            <div className="relative w-[280px] rounded-[2.5rem] border-[8px] border-gray-800 bg-gray-800 shadow-2xl shadow-black/30 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-gray-800 rounded-b-2xl z-10" />
              <div className="relative bg-gradient-to-b from-white to-gray-50 rounded-[2rem] overflow-hidden aspect-[9/19.5]">
                <div className="h-12 bg-white flex items-end justify-between px-6 pb-1">
                  <span className="text-[10px] font-semibold text-gray-900">9:41</span>
                  <div className="flex gap-1 items-center"><div className="w-3.5 h-2.5 border border-gray-400 rounded-sm relative"><div className="absolute inset-[1px] right-[2px] bg-gray-400 rounded-[1px]" /></div></div>
                </div>
                <div className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-lg bg-land-green-600 flex items-center justify-center text-[9px] font-bold text-white">A</div><span className="text-xs font-bold text-gray-900">AlphaSeekers</span></div>
                  <p className="text-[9px] text-gray-400">{t('howItWorks.mockup.welcomeBack')}</p>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm"><p className="text-[8px] text-gray-400">{t('howItWorks.mockup.classes')}</p><p className="text-sm font-bold text-gray-900">3</p></div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm"><p className="text-[8px] text-gray-400">{t('howItWorks.mockup.today')}</p><p className="text-sm font-bold text-land-green-600">{t('howItWorks.mockup.todayValue')}</p></div>
                  </div>
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div><p className="text-[9px] font-semibold text-gray-900">{t(`howItWorks.mockup.mockClassNames.${j}`)}</p><p className="text-[8px] text-gray-400 mt-0.5">{t(`howItWorks.mockup.mockTimes.${j}`)}</p></div>
                        <div className="w-6 h-6 rounded-lg bg-land-green-50 flex items-center justify-center"><svg className="w-3 h-3 text-land-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
