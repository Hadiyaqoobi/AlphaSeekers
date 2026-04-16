'use client';

import { useTranslations } from 'next-intl';

export function WebinarsComingSoon() {
  const t = useTranslations('webinars');

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-land-green-900 to-land-green-950 px-8 py-16 lg:py-24">
        {/* Decorative blob */}
        <div
          className="absolute blur-[120px] rounded-full opacity-20"
          style={{ width: 400, height: 400, top: '30%', left: '60%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(29,185,100,0.12) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
          aria-hidden="true"
        />

        <div className="relative text-center max-w-2xl mx-auto">
          {/* Mic / broadcast icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-land-green-600/15 border border-land-green-500/25">
            <svg className="w-8 h-8 text-land-green-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          {/* Kicker */}
          <p className="text-land-green-400 text-sm font-semibold uppercase tracking-[0.15em] mb-4">
            {t('comingSoon.kicker')}
          </p>

          {/* Title */}
          <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>
            {t('comingSoon.title')}
          </h2>

          {/* Body */}
          <p className="text-lg text-white/55 max-w-xl mx-auto leading-relaxed mb-10">
            {t('comingSoon.body')}
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {(['pill1', 'pill2', 'pill3'] as const).map((key) => (
              <span
                key={key}
                className="bg-dark-100/[0.06] border border-white/[0.08] text-white/70 text-sm font-medium px-5 py-2 rounded-full"
              >
                {t(`comingSoon.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
