'use client';

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const stepIcons = [
  'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
  'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  'M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59',
  'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z',
];

export function WorkflowPipeline() {
  const t = useTranslations('landing');
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const steps = stepIcons.map((icon, i) => ({
    icon,
    title: t(`pipeline.steps.${i}.title`),
    desc: t(`pipeline.steps.${i}.desc`),
  }));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { rootMargin: '-80px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stepDelay = (i: number) => 0.3 + i * 0.5;
  const lineDelay = (i: number) => 0.3 + i * 0.5 + 0.15;

  return (
    <section className="relative w-full py-24 overflow-hidden" id="workflow">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,230,118,0.05)_0%,transparent_60%)] pointer-events-none" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.15em] text-neon-500 font-medium mb-4">{t('pipeline.kicker')}</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t('pipeline.title')}</h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">{t('pipeline.subtitle')}</p>
        </div>
        <div ref={ref} className="relative">
          <div className="hidden lg:grid lg:grid-cols-5 lg:gap-0 relative">
            {[0,1,2,3].map(i => (
              <div
                key={`line-${i}`}
                className="absolute top-8 h-[2px]"
                style={{
                  left: `calc(${(i+1)*20}% - 10%)`,
                  width: 'calc(20%)',
                  background: 'linear-gradient(90deg, rgba(0,230,118,0.35), rgba(0,229,255,0.25), rgba(0,230,118,0.35))',
                  boxShadow: inView ? '0 0 8px rgba(0,229,255,0.25)' : 'none',
                  transform: inView ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: `transform 0.4s cubic-bezier(0.16,1,0.3,1) ${lineDelay(i)}s, box-shadow 0.4s ${lineDelay(i)}s`,
                }}
              />
            ))}
            {steps.map((step, i) => (
              <div key={step.title} className="group flex flex-col items-center text-center relative z-10" style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(20px)', transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${stepDelay(i)}s` }}>
                <div className="relative">
                  {/* Pulse glow ring */}
                  <div className="absolute -inset-2 rounded-2xl bg-neon-500/15 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300" />
                  <div
                    className="relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:border-neon-500/60 group-hover:bg-neon-500/15 group-hover:shadow-[0_0_25px_rgba(0,230,118,0.3)]"
                    style={{
                      background: inView ? 'rgba(0,230,118,0.08)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${inView ? 'rgba(0,230,118,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: inView ? '0 0 20px rgba(0,230,118,0.18)' : 'none',
                      transitionDelay: `${stepDelay(i)}s`,
                    }}
                  >
                    <svg className="w-7 h-7 text-neon-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={step.icon} /></svg>
                  </div>
                </div>
                <p className="text-white text-sm font-semibold mt-4">{step.title}</p>
                <p className="text-white/45 text-xs mt-1 max-w-[140px]">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="lg:hidden space-y-8">
            {steps.map((step, i) => (
              <div key={step.title} className="flex items-start gap-5" style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(20px)', transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s` }}>
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-land-green-600/10 border border-land-green-500/30 flex items-center justify-center flex-shrink-0" style={{ boxShadow: inView ? '0 0 16px rgba(29,185,100,0.12)' : 'none' }}>
                    <svg className="w-6 h-6 text-land-green-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={step.icon} /></svg>
                  </div>
                  {i < steps.length - 1 && <div className="w-[2px] h-8 bg-land-green-500/20 mt-2 origin-top" style={{ transform: inView ? 'scaleY(1)' : 'scaleY(0)', transition: `transform 0.3s ease ${0.15*i+0.2}s` }} />}
                </div>
                <div className="pt-3"><p className="text-white text-sm font-semibold">{step.title}</p><p className="text-white/45 text-xs mt-1">{step.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom glow divider */}
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 mt-16">
        <div className="h-px bg-gradient-to-r from-transparent via-neon-500/30 to-transparent" />
      </div>
    </section>
  );
}
