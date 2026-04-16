'use client';

import { useTranslations } from 'next-intl';

export function LibraryComingSoon() {
  const t = useTranslations('library');

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl bg-land-green-950 px-8 py-16 lg:py-24">
        {/* Decorative blob */}
        <div
          className="absolute blur-[120px] rounded-full opacity-20"
          style={{ width: 400, height: 400, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(29,185,100,0.12) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
          aria-hidden="true"
        />

        <div className="relative text-center max-w-2xl mx-auto">
          {/* Book icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-land-green-600/15 border border-land-green-500/25">
            <svg className="w-8 h-8 text-land-green-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
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
