'use client';

import { useTranslations } from 'next-intl';

export function LogoTicker() {
  const t = useTranslations('landing');
  const orgs = [
    'Khan Academy',
    'SOLA',
    'UNICEF',
    'UNESCO',
    'Teach For All',
    'Room to Read',
    'Code.org',
    'Malala Fund',
  ];

  return (
    <section className="w-full py-16 bg-land-cream">
      <p className="text-center text-sm text-gray-400 font-medium tracking-wide uppercase mb-8">
        {t('ticker.label')}
      </p>
      <div className="relative overflow-hidden group">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-land-cream to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-land-cream to-transparent z-10 pointer-events-none" />

        <div
          className="flex whitespace-nowrap group-hover:[animation-play-state:paused]"
          style={{
            animation: 'marquee 35s linear infinite',
          }}
        >
          {/* Duplicate for seamless loop */}
          {[...orgs, ...orgs].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="inline-flex items-center px-10 text-lg font-semibold text-gray-300 flex-shrink-0 select-none"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
