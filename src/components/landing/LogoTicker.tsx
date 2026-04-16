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
    <section className="relative w-full py-16 overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,229,255,0.04)_0%,transparent_70%)] pointer-events-none" aria-hidden="true" />

      <div className="relative">
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-neon-500/70 font-medium mb-8">
          {t('ticker.label')}
        </p>

        <div className="relative overflow-hidden group">
          {/* Fade edges to the page background */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-dark-DEFAULT to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-dark-DEFAULT to-transparent z-10 pointer-events-none" />

          <div
            className="flex whitespace-nowrap group-hover:[animation-play-state:paused]"
            style={{ animation: 'marquee 35s linear infinite' }}
          >
            {/* Duplicate for seamless loop */}
            {[...orgs, ...orgs].map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="inline-flex items-center mx-3 px-5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.025] flex-shrink-0 select-none transition-colors hover:border-neon-500/25 hover:bg-neon-500/[0.04]"
              >
                <span className="text-sm font-medium text-white/55 whitespace-nowrap tracking-wide">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
