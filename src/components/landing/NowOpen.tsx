'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import type { LandingHighlights } from '@/lib/platform/landing-highlights';

type NowOpenProps = {
  locale: string;
  signedIn: boolean;
  highlights: LandingHighlights;
};

/**
 * Live "what's open right now" panel. Renders nothing at all when there is
 * nothing open — an empty section on a marketing page is worse than no section.
 *
 * Deliberately has no scroll-reveal animation. Every other section on this page
 * starts at opacity:0 and depends on an IntersectionObserver to become visible,
 * which is why the stylesheet carries a `force-visible` fallback for when
 * hydration fails. That fallback only reaches `section > div`, so cards nested
 * deeper would stay invisible. This is the one section a visitor arriving from
 * a poster needs to see, so its content never depends on JavaScript running.
 */
export function NowOpen({ locale, signedIn, highlights }: NowOpenProps) {
  const t = useTranslations('landing');

  const { classes, webinars, opportunities } = highlights;
  const total = classes.length + webinars.length + opportunities.length;
  if (total === 0) return null;

  // A signed-out visitor cannot open the class page (it is behind login), so
  // point them at registration rather than a redirect they will bounce off.
  const joinHref = signedIn ? `/${locale}/classes` : `/${locale}/register`;

  // A course with its own registration form takes priority: signing up for
  // AlphaSeekers is not the same as signing up for that course, which is the
  // whole point of the field.
  const courseHref = (c: { registrationFormUrl: string | null }) =>
    c.registrationFormUrl ?? joinHref;
  const isExternal = (c: { registrationFormUrl: string | null }) => Boolean(c.registrationFormUrl);

  const dateFmt = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-AF' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section className="relative w-full bg-land-dark py-20 lg:py-24" id="now-open">
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-land-green-400">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-land-green-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-land-green-400" />
              </span>
              {t('nowOpen.kicker')}
            </p>
            <h2
              className="text-3xl font-bold tracking-tight text-white lg:text-4xl"
              style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
            >
              {t('nowOpen.title')}
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/55">{t('nowOpen.subtitle')}</p>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-land-green-500 px-6 py-3 text-sm font-bold text-black transition-all duration-200 hover:-translate-y-0.5 hover:bg-land-green-400 active:translate-y-0"
            href={joinHref}
          >
            {t('nowOpen.cta')}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <article
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-land-green-500/40"
              key={c.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-land-green-500/15 px-2.5 py-1 text-xs font-semibold text-land-green-400">
                  {c.subjectCategory}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
                  {t('nowOpen.free')}
                </span>
              </div>

              <h3 className="text-lg font-bold leading-snug text-white">{c.name}</h3>

              <dl className="mt-auto flex flex-col gap-1.5 text-sm text-white/55">
                {c.teacherName ? (
                  <div className="flex gap-2">
                    <dt className="text-white/35">{t('nowOpen.instructor')}</dt>
                    <dd>{c.teacherName}</dd>
                  </div>
                ) : null}
                {c.schedulePreference ? (
                  <div className="flex gap-2">
                    <dt className="text-white/35">{t('nowOpen.when')}</dt>
                    <dd>{c.schedulePreference}</dd>
                  </div>
                ) : null}
                {typeof c.seatsLeft === 'number' && c.seatsLeft > 0 ? (
                  <div className="flex gap-2">
                    <dt className="text-white/35">{t('nowOpen.seats')}</dt>
                    <dd>{c.seatsLeft}</dd>
                  </div>
                ) : null}
              </dl>

              {isExternal(c) ? (
                <a
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-land-green-400 transition-colors hover:text-land-green-300"
                  href={courseHref(c)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('nowOpen.register')}
                  <span aria-hidden="true">→</span>
                </a>
              ) : (
                <Link
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-land-green-400 transition-colors hover:text-land-green-300"
                  href={joinHref}
                >
                  {t('nowOpen.enrol')}
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </article>
          ))}

          {webinars.map((w) => (
            <article
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-land-green-500/40"
              key={w.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-400/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
                  {t('nowOpen.webinar')}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">{w.language}</span>
              </div>
              <h3 className="text-lg font-bold leading-snug text-white">{w.title}</h3>
              <p className="mt-auto text-sm text-white/55">{dateFmt.format(new Date(w.startsAt))}</p>
              <Link
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-land-green-400 transition-colors hover:text-land-green-300"
                href={signedIn ? `/${locale}/webinars` : `/${locale}/register`}
              >
                {t('nowOpen.reserve')}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}

          {opportunities.map((o) => (
            <article
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-land-green-500/40"
              key={o.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
                  {t('nowOpen.opportunity')}
                </span>
              </div>
              <h3 className="text-lg font-bold leading-snug text-white">{o.title}</h3>
              <p className="mt-auto text-sm text-white/55">
                {t('nowOpen.closes')} {dateFmt.format(new Date(o.deadline))}
              </p>
              <Link
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-land-green-400 transition-colors hover:text-land-green-300"
                href={signedIn ? `/${locale}/opportunities` : `/${locale}/register`}
              >
                {t('nowOpen.readMore')}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
