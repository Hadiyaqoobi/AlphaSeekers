'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export type SocialLinks = {
  instagram?: string | null;
  facebook?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
  telegram?: string | null;
};

type FooterProps = {
  locale: string;
  signedIn: boolean;
  socialLinks?: SocialLinks;
};

export function Footer({ locale, signedIn, socialLinks }: FooterProps) {
  const t = useTranslations('landing');

  function gatedHref(target: string) {
    return signedIn ? target : `/${locale}/login?next=${encodeURIComponent(target)}`;
  }

  const hasAnySocial =
    !!socialLinks &&
    (socialLinks.instagram ||
      socialLinks.facebook ||
      socialLinks.twitter ||
      socialLinks.linkedin ||
      socialLinks.youtube ||
      socialLinks.telegram);

  return (
    <footer className="w-full bg-land-dark pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/wordmark-192.png"
                alt="AlphaSeekers"
                width={76}
                height={60}
              />
            </div>
            <p className="text-sm text-white/40 max-w-xs leading-relaxed">
              {t('footer.brandDesc')}
            </p>

            {/* Social icons — each icon is rendered ONLY if its URL is set
                in admin Site Settings. Hidden entirely when no socials configured. */}
            {hasAnySocial ? (
              <div className="flex items-center gap-3 mt-5" aria-label="Social media">
                {socialLinks?.instagram ? <SocialIconLink href={socialLinks.instagram} label="Instagram"><InstagramIcon /></SocialIconLink> : null}
                {socialLinks?.facebook  ? <SocialIconLink href={socialLinks.facebook}  label="Facebook"><FacebookIcon /></SocialIconLink>   : null}
                {socialLinks?.twitter   ? <SocialIconLink href={socialLinks.twitter}   label="X (Twitter)"><TwitterIcon /></SocialIconLink> : null}
                {socialLinks?.linkedin  ? <SocialIconLink href={socialLinks.linkedin}  label="LinkedIn"><LinkedInIcon /></SocialIconLink>   : null}
                {socialLinks?.youtube   ? <SocialIconLink href={socialLinks.youtube}   label="YouTube"><YouTubeIcon /></SocialIconLink>     : null}
                {socialLinks?.telegram  ? <SocialIconLink href={socialLinks.telegram}  label="Telegram"><TelegramIcon /></SocialIconLink>   : null}
              </div>
            ) : null}
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
      <span className="absolute left-0 -bottom-0.5 w-full h-[1px] bg-dark-100/40 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
    </Link>
  );
}

/* External social link wrapping a 20×20 icon */
function SocialIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-all hover:bg-white/10 hover:text-white"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
    >
      {children}
    </a>
  );
}

/* ── Inline social SVGs (no external icon dep) ── */
function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 22v-8h2.8l.4-3.2H13V8.7c0-.9.3-1.6 1.7-1.6H16V4.2c-.3 0-1.3-.2-2.4-.2-2.4 0-4 1.5-4 4.1v2.6H7v3.2h2.6V22H13z" />
    </svg>
  );
}
function TwitterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 11.001-4.121A2.06 2.06 0 015.34 7.43zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}
function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.4 2.6L1.7 10.6c-1.4.6-1.4 1.4-.3 1.7l5.3 1.7 12.3-7.7c.6-.4 1.1-.2.6.2L9.7 14.5l-.4 5.4c.5 0 .8-.2 1.1-.5l2.6-2.5 5.4 4c1 .6 1.7.3 1.9-.9l3.5-16.4c.3-1.5-.5-2.2-1.4-1z" />
    </svg>
  );
}
