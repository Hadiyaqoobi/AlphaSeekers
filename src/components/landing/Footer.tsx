'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

type FooterProps = {
  locale: string;
  signedIn: boolean;
};

export function Footer({ locale, signedIn }: FooterProps) {
  const t = useTranslations('landing');

  function gatedHref(target: string) {
    return signedIn ? target : `/${locale}/login?next=${encodeURIComponent(target)}`;
  }

  return (
    <footer className="w-full bg-land-dark pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10 text-sm font-bold text-white">
                A
              </span>
              <span
                className="text-xl font-bold text-white tracking-tight"
                style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
              >
                AlphaSeekers
              </span>
            </div>
            <p className="text-sm text-white/40 max-w-xs leading-relaxed">
              {t('footer.brandDesc')}
            </p>
          </div>

          {/* Programs */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">{t('footer.colPrograms')}</h4>
            <ul className="space-y-2.5">
              <li><FooterLink href={gatedHref(`/${locale}/classes`)}>{t('footer.onlineClasses')}</FooterLink></li>
              <li><FooterLink href={gatedHref(`/${locale}/webinars`)}>{t('footer.webinars')}</FooterLink></li>
              <li><FooterLink href={gatedHref(`/${locale}/opportunities`)}>{t('footer.opportunities')}</FooterLink></li>
              <li><FooterLink href={gatedHref(`/${locale}/library`)}>{t('footer.library')}</FooterLink></li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">{t('footer.colAbout')}</h4>
            <ul className="space-y-2.5">
              <li><FooterLink href={`/${locale}#workflow`}>{t('footer.ourMission')}</FooterLink></li>
              <li><FooterLink href={`/${locale}#how-it-works`}>{t('footer.howItWorks')}</FooterLink></li>
              <li><FooterLink href={`/${locale}/team`}>{t('footer.team')}</FooterLink></li>
              <li><FooterLink href={`/${locale}/register`}>{t('footer.volunteer')}</FooterLink></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">{t('footer.colResources')}</h4>
            <ul className="space-y-2.5">
              <li><FooterLink href={gatedHref(`/${locale}/study-assistant`)}>{t('footer.aiAssistant')}</FooterLink></li>
              <li><FooterLink href={`/${locale}#faq`}>{t('footer.faq')}</FooterLink></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/25">© {new Date().getFullYear()} AlphaSeekers</p>
          <p className="text-xs text-white/25 italic">
            {t('footer.missionLine')}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* Footer link with sliding underline on hover */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      className="relative text-sm text-white/50 hover:text-white/80 transition-colors inline-block group"
      href={href}
    >
      {children}
      <span className="absolute left-0 -bottom-0.5 w-full h-[1px] bg-white/40 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
    </Link>
  );
}
