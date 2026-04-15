'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ScrollReveal } from './ScrollReveal';

const userMessage = 'فتوسنتز چیست؟';
const aiResponse = 'فتوسنتز فرآیندی است که گیاهان با استفاده از نور خورشید، آب و دی‌اکسید کربن، غذا (گلوکز) و اکسیژن تولید می‌کنند. این فرآیند در کلروپلاست‌های برگ انجام می‌شود.';
const featureIcons = [
  'M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495A18.023 18.023 0 013.75 7.488',
  'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
];

function useNaturalTyping(text: string, shouldAnimate: boolean, delay: number = 0) {
  const [displayText, setDisplayText] = useState('');
  const [isDone, setIsDone] = useState(false);
  useEffect(() => {
    if (!shouldAnimate) { setDisplayText(text); setIsDone(true); return; }
    setDisplayText(''); setIsDone(false);
    let i = 0; let timer: number;
    const startTime = Date.now();
    function type() {
      if (Date.now() - startTime < delay) { timer = window.setTimeout(type, delay - (Date.now() - startTime)); return; }
      if (i < text.length) { i++; setDisplayText(text.slice(0, i)); timer = window.setTimeout(type, 35 + Math.random() * 40); }
      else setIsDone(true);
    }
    timer = window.setTimeout(type, delay);
    return () => clearTimeout(timer);
  }, [text, shouldAnimate, delay]);
  return { displayText, isDone };
}

export function AIShowcase() {
  const t = useTranslations('landing');
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [onlinePulse, setOnlinePulse] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { rootMargin: '-80px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const userTyping = useNaturalTyping(userMessage, inView, 800);
  const aiTyping = useNaturalTyping(aiResponse, inView, 2500);

  useEffect(() => {
    if (!inView) return;
    const t1 = setTimeout(() => setOnlinePulse(true), 300);
    const t2 = setTimeout(() => setShowThinking(true), 1600);
    const t3 = setTimeout(() => setShowThinking(false), 2500);
    const t4 = setTimeout(() => setShowSource(true), 6500);
    const t5 = setTimeout(() => setShowFeedback(true), 7000);
    return () => { [t1,t2,t3,t4,t5].forEach(clearTimeout); };
  }, [inView]);

  return (
    <section className="relative w-full py-24 bg-land-dark overflow-hidden" ref={ref}>
      <div className="absolute blur-[100px] rounded-full opacity-20" style={{ width: 400, height: 400, top: '30%', left: '15%', background: 'radial-gradient(circle, #1DB964 0%, transparent 70%)' }} aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <ScrollReveal><div className="text-center mb-16">
          <p className="text-land-amber text-sm font-semibold uppercase tracking-[0.15em] mb-4">{t('aiShowcase.kicker')}</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t('aiShowcase.title')}</h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">{t('aiShowcase.subtitle')}</p>
        </div></ScrollReveal>
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div style={{ opacity: inView ? 1 : 0, transform: inView ? 'scale(1)' : 'scale(0.95)', transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
            <div className="bg-land-dark-200 border border-white/[0.06] rounded-2xl p-6 max-w-md mx-auto lg:max-w-none">
              <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                <div className="w-8 h-8 rounded-lg bg-land-green-600/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-land-green-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t('aiShowcase.chatHeader')}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-land-green-400" style={{ boxShadow: onlinePulse ? '0 0 6px rgba(52,208,126,0.6)' : 'none', animation: onlinePulse ? 'pulse-soft 1.5s ease-in-out infinite' : 'none' }} />
                    <span className="text-xs text-white/40">{t('aiShowcase.chatOnline')}</span>
                  </div>
                </div>
              </div>
              <div className="py-6 space-y-4 min-h-[180px]" dir="rtl">
                {userTyping.displayText && <div className="flex justify-start"><div className="bg-land-green-600/20 rounded-2xl rounded-tr-md px-4 py-3 max-w-[85%]"><p className="text-sm text-white" dir="rtl">{userTyping.displayText}</p></div></div>}
                {showThinking && !aiTyping.displayText && <div className="flex justify-end" dir="rtl"><div className="bg-white/[0.05] rounded-2xl rounded-tl-md px-4 py-3"><div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" style={{ animation: 'pulse-soft 1s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />)}</div></div></div>}
                {aiTyping.displayText && <div className="flex justify-end" dir="rtl"><div className="max-w-[85%]"><div className="bg-white/[0.05] rounded-2xl rounded-tl-md px-4 py-3"><p className="text-sm text-white/80 leading-relaxed" dir="rtl">{aiTyping.displayText}</p></div>
                  <p className="text-xs text-white/30 mt-2 text-left" dir="ltr" style={{ opacity: showSource ? 1 : 0, transition: 'opacity 0.5s' }}>{t('aiShowcase.chatSource')} {t('aiShowcase.sourceText')}</p>
                  <div className="flex gap-2 mt-2" dir="ltr" style={{ opacity: showFeedback ? 1 : 0, transition: 'opacity 0.5s' }}>
                    <button className="text-white/20 hover:text-white/50 transition-colors" aria-label="Helpful"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" /></svg></button>
                    <button className="text-white/20 hover:text-white/50 transition-colors" aria-label="Not helpful"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 012.25 12c0-2.848.992-5.464 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h4.016a4.5 4.5 0 011.423.23l3.114 1.04a4.5 4.5 0 001.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 007.5 19.75 2.25 2.25 0 009.75 22a.75.75 0 00.75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 002.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C15.113 3.953 15.893 3.5 16.726 3.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" /></svg></button>
                  </div></div></div>}
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3"><span className="text-sm text-white/25">{t('aiShowcase.chatPlaceholder')}</span></div>
                <button className="w-10 h-10 rounded-xl bg-land-green-600/20 flex items-center justify-center text-land-green-400 flex-shrink-0" aria-label="Send"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-12 lg:mt-0">
            {featureIcons.map((icon, i) => (
              <ScrollReveal key={i} delay={i * 0.15}>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.08] hover:border-land-green-500/30 group">
                  <svg className="w-5 h-5 text-land-green-400 mb-3 group-hover:text-land-green-300 transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
                  <h3 className="text-white text-sm font-semibold">{t(`aiShowcase.features.${i}.title`)}</h3>
                  <p className="text-white/40 text-xs mt-1">{t(`aiShowcase.features.${i}.desc`)}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
