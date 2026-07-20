'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type HeroProps = {
  locale: string;
  signedIn: boolean;
  studentLabel: string;
  teacherLabel: string;
};

/* ── Animated Platform Mockup ── */
const mockClassColors = ['#10b981', '#0ea5e9', '#f59e0b'];
const mockTeachers = ['Ms. Sarah', 'Mr. Ahmad', 'Ms. Leila'];

function PlatformMockup() {
  const t = useTranslations('landing.howItWorks.mockup');
  const classNames = t.raw('mockClassNames') as string[];
  const times = t.raw('mockTimes') as string[];
  const mockClasses = classNames.map((name, i) => ({
    name,
    teacher: mockTeachers[i],
    time: times[i],
    color: mockClassColors[i],
  }));
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const timings = [2000, 1000, 1000, 1500, 1000, 500];
    const timer = setTimeout(() => {
      if (phase < 5) setPhase(phase + 1);
      else { setPhase(0); setCycle(c => c + 1); }
    }, timings[phase]);
    return () => clearTimeout(timer);
  }, [phase, cycle]);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/[0.08]">
      <div className="bg-[#1a1a2e] px-4 py-3 flex items-center gap-3 border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 bg-dark-100/[0.06] rounded-lg px-3 py-1.5 text-xs text-white/40 font-mono">
          alphaseekers.onrender.com
        </div>
      </div>
      <div
        className="bg-[#0f1419] p-5 min-h-[280px] relative"
        style={{ opacity: phase === 5 ? 0 : 1, transition: 'opacity 0.5s' }}
        key={cycle}
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/icon-64.png" alt="" aria-hidden="true" width={28} height={28} className="rounded-lg" />
          <span className="text-xs font-bold text-white">{t('myClasses')}</span>
          <span className="ml-auto text-[10px] text-white/30">{t('welcomeBack')}</span>
        </div>
        <div className="space-y-2.5">
          {mockClasses.map((cls, i) => (
            <div
              key={cls.name}
              className="bg-dark-100/[0.04] border border-white/[0.06] rounded-xl p-3 flex items-center gap-3"
              style={{
                opacity: phase >= 0 ? 1 : 0,
                transform: phase >= 0 ? 'translateY(0)' : 'translateY(10px)',
                transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.12}s`,
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cls.color}20` }}>
                <div className="w-2 h-2 rounded-full" style={{ background: cls.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-white truncate">{cls.name}</p>
                <p className="text-[9px] text-white/30">{cls.teacher} · {cls.time}</p>
              </div>
              {i === 0 ? (
                <button
                  className="text-[9px] font-bold px-3 py-1.5 rounded-lg transition-all duration-300 flex-shrink-0"
                  style={{
                    background: phase >= 2 ? 'rgba(29,185,100,0.2)' : 'rgba(29,185,100,0.1)',
                    color: phase >= 2 ? '#34d07e' : '#1DB964',
                    transform: phase === 1 ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: phase === 1 ? '0 0 12px rgba(29,185,100,0.3)' : 'none',
                  }}
                >
                  {phase >= 2 ? '✓ Enrolled' : 'Enroll'}
                </button>
              ) : (
                <span className="text-[9px] text-white/20 flex-shrink-0">Enrolled</span>
              )}
            </div>
          ))}
        </div>
        <div
          className="absolute top-3 right-3 bg-[#1e293b] border border-white/[0.1] rounded-xl px-3 py-2.5 shadow-xl max-w-[200px]"
          style={{
            opacity: phase >= 3 && phase < 5 ? 1 : 0,
            transform: phase >= 3 && phase < 5 ? 'translateX(0)' : 'translateX(20px)',
            transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0">📱</span>
            <div>
              <p className="text-[9px] font-semibold text-white">WhatsApp</p>
              <p className="text-[8px] text-white/50 mt-0.5 leading-relaxed">Your English class starts in 1 hour!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero({ locale, signedIn, studentLabel, teacherLabel }: HeroProps) {
  const t = useTranslations('landing');
  const ht = useTranslations('home');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(true); }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-dark-DEFAULT">
      {/* Wave image — atmospheric, not dominant */}
      <div className="absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0 bg-wave-pattern bg-cover bg-center opacity-25 scale-110"
          style={{ filter: 'blur(1px) saturate(1.2)' }}
        />
        {/* Top + bottom fade so navbar/CTA areas stay clean */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-DEFAULT via-transparent to-dark-DEFAULT" />
        {/* Center vignette — focuses the energy in the middle */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 25%, #070B0E 85%)' }} />
      </div>

      {/* Subtle drifting glow blobs (electric green + cyan) */}
      <div className="absolute rounded-full blur-[150px] opacity-30" style={{ width: 600, height: 600, top: '20%', left: '70%', background: 'radial-gradient(circle, rgba(0,229,255,0.18) 0%, transparent 70%)', animation: 'blob-drift-1 25s ease-in-out infinite' }} aria-hidden="true" />
      <div className="absolute rounded-full blur-[120px] opacity-25" style={{ width: 500, height: 500, top: '80%', left: '20%', background: 'radial-gradient(circle, rgba(0,230,118,0.18) 0%, transparent 70%)', animation: 'blob-drift-2 30s ease-in-out infinite' }} aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center min-h-screen">
        <div className="max-w-xl">
          {/* Pill */}
          <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(20px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s' }}>
            <span className="inline-flex items-center gap-2.5 rounded-full bg-land-green-600/15 border border-land-green-500/25 px-5 py-2 text-sm font-medium text-land-green-300">
              <span className="flex h-2 w-2 rounded-full bg-land-green-400 animate-[pulse-soft_2s_ease-in-out_infinite]" style={{ boxShadow: '0 0 8px rgba(52,208,126,0.5)' }} />
              {t('hero.pill')}
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(20px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s', fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
            className="mt-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.05]"
          >
            {ht('hero.headline1')}{' '}<br className="hidden sm:block" />
            {ht('hero.headline2')}{' '}
            <span className="relative inline-block">
              <span className="gradient-text">{ht('hero.highlightWord')}</span>
              <span
                className="absolute -bottom-1 left-0 w-full h-[3px] origin-left rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #00E676 0%, #00E5FF 50%, #2979FF 100%)',
                  boxShadow: '0 0 12px rgba(0,229,255,0.5)',
                  animation: loaded ? 'underline-draw-dramatic 1.2s cubic-bezier(0.25,0.46,0.45,0.94) 1.4s forwards' : 'none',
                  transform: 'scaleX(0)',
                }}
              />
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(20px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s' }} className="mt-7 text-lg lg:text-xl text-white/55 max-w-xl leading-relaxed">
            {t('hero.subtitle')}
          </p>

          {/* CTA buttons */}
          <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(20px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.65s' }} className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link href={signedIn ? `/${locale}/dashboard` : `/${locale}/register`} className="group pulse-glow inline-flex items-center justify-center gap-3 py-4 px-8 rounded-xl bg-neon-500 text-dark-DEFAULT text-base font-bold transition-all duration-200 hover:bg-neon-400 hover:-translate-y-0.5 active:translate-y-0">
              {signedIn ? 'Dashboard' : studentLabel}
              <svg className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
            </Link>
            <Link href={signedIn ? `/${locale}/teacher/availability` : `/${locale}/register`} className="inline-flex items-center justify-center gap-3 py-4 px-8 rounded-xl bg-dark-100/[0.06] border border-white/[0.12] text-white text-base font-semibold transition-all duration-200 hover:bg-dark-100/[0.12] hover:-translate-y-0.5 active:translate-y-0">
              {teacherLabel}
            </Link>
          </div>

          {/* Trust strip */}
          <div style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'translateY(20px)', transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.8s' }} className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
            {[
              { label: ht('hero.trustFree'), icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
              { label: ht('hero.trustSafe'), icon: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z' },
              { label: ht('hero.trustOffline'), icon: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3' },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-2 text-sm text-white/40">
                <svg className="w-4 h-4 text-land-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right column — Animated Platform Mockup */}
        <div className="relative mt-16 lg:mt-0 hidden lg:block" style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'scale(1)' : 'scale(0.92)', transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.6s' }}>
          <PlatformMockup />
          <div className="absolute -top-4 -right-4 lg:-right-8 bg-dark-100/[0.07] backdrop-blur-xl border border-white/[0.12] rounded-2xl px-5 py-3.5 z-10" style={{ animation: 'float-gentle 4s ease-in-out infinite' }}>
            <p className="text-sm font-semibold text-white">{t('hero.floatBadge1Title')}</p>
            <p className="text-xs text-white/40">{t('hero.floatBadge1Sub')}</p>
          </div>
          <div className="absolute -bottom-2 -left-4 lg:-left-8 bg-dark-100/[0.07] backdrop-blur-xl border border-white/[0.12] rounded-2xl px-5 py-3.5 flex items-center gap-3 z-10" style={{ animation: 'float-gentle 4s ease-in-out 1.5s infinite' }}>
            <div className="flex -space-x-2">
              <span className="w-8 h-8 rounded-full bg-land-green-600/30 border-2 border-white/10 flex items-center justify-center text-xs font-bold text-land-green-300">F</span>
              <span className="w-8 h-8 rounded-full bg-amber-500/20 border-2 border-white/10 flex items-center justify-center text-xs font-bold text-amber-300">Z</span>
              <span className="w-8 h-8 rounded-full bg-sky-500/20 border-2 border-white/10 flex items-center justify-center text-xs font-bold text-sky-300">M</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{t('hero.floatBadge2Title')}</p>
              <p className="text-xs text-white/40">{t('hero.floatBadge2Sub')}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-[float-gentle_2s_ease-in-out_infinite]">
        <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-white/30 to-white/10" />
      </div>
    </section>
  );
}
