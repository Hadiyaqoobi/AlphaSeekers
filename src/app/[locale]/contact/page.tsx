import { getTranslations } from "next-intl/server";

import { getSiteSettings } from "@/lib/platform/site-settings";

type ContactPageProps = { params: { locale: string } };

export async function generateMetadata({ params }: ContactPageProps) {
  const t = await getTranslations({ locale: params.locale, namespace: "contact" });
  return {
    title: `${t("title")} — AlphaSeekers`,
    description: t("subtitle"),
  };
}

// Every channel below is admin-editable in Site Settings. A channel with no URL
// saved is simply not rendered, so this page never shows a dead link.
export default async function ContactPage({ params }: ContactPageProps) {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "contact" });
  const s = await getSiteSettings();

  const channels: Array<{ key: string; label: string; value: string; href: string; icon: React.ReactNode }> = [];

  if (s.contactEmail) {
    channels.push({
      key: "email",
      label: t("email"),
      value: s.contactEmail,
      href: `mailto:${s.contactEmail}`,
      icon: <MailIcon />,
    });
  }
  if (s.whatsappUrl) {
    channels.push({ key: "whatsapp", label: "WhatsApp", value: t("whatsappValue"), href: s.whatsappUrl, icon: <WhatsAppIcon /> });
  }
  if (s.facebookUrl) {
    channels.push({ key: "facebook", label: "Facebook", value: t("facebookValue"), href: s.facebookUrl, icon: <FacebookIcon /> });
  }
  if (s.instagramUrl) {
    channels.push({ key: "instagram", label: "Instagram", value: t("instagramValue"), href: s.instagramUrl, icon: <InstagramIcon /> });
  }
  if (s.youtubeUrl) {
    channels.push({ key: "youtube", label: "YouTube", value: t("youtubeValue"), href: s.youtubeUrl, icon: <YouTubeIcon /> });
  }
  if (s.linkedinUrl) {
    channels.push({ key: "linkedin", label: "LinkedIn", value: t("linkedinValue"), href: s.linkedinUrl, icon: <LinkedInIcon /> });
  }
  if (s.telegramUrl) {
    channels.push({ key: "telegram", label: "Telegram", value: t("telegramValue"), href: s.telegramUrl, icon: <TelegramIcon /> });
  }
  if (s.twitterUrl) {
    channels.push({ key: "twitter", label: "X (Twitter)", value: t("twitterValue"), href: s.twitterUrl, icon: <TwitterIcon /> });
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-land-dark">
        <div
          aria-hidden="true"
          className="absolute rounded-full opacity-20 blur-[120px]"
          style={{ width: 400, height: 400, top: "40%", left: "60%", background: "radial-gradient(circle, rgba(29,185,100,0.12) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-7xl px-6 py-24 text-center lg:px-8 lg:py-32">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-land-green-400">{t("kicker")}</p>
          <h1
            className="text-4xl font-bold tracking-tight text-white lg:text-5xl"
            style={{ fontFamily: "var(--font-landing), var(--font-display-latin), sans-serif" }}
          >
            {t("title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55">{t("subtitle")}</p>
        </div>
      </section>

      {/* Channels */}
      <section className="bg-[var(--bg-base)] py-20 lg:py-28">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          {channels.length === 0 ? (
            <p className="text-center text-base text-ink-soft">{t("empty")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {channels.map((c) => (
                <a
                  className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-dark-100 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-land-green-500/40"
                  href={c.href}
                  key={c.key}
                  rel="noopener noreferrer"
                  target={c.href.startsWith("mailto:") ? undefined : "_blank"}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-land-green-500/10 text-land-green-400">
                    {c.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-main">{c.label}</span>
                    <span className="mt-1 block break-words text-sm text-ink-soft group-hover:text-ink-main">{c.value}</span>
                  </span>
                </a>
              ))}
            </div>
          )}

          <p className="mt-10 text-center text-sm leading-7 text-ink-soft">{t("responseNote")}</p>
        </div>
      </section>
    </>
  );
}

/* ── Inline icons (no external icon dep, matching the footer) ── */
function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 004.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 1.67c2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.83c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 01-1.26-4.38c0-4.54 3.7-8.25 8.24-8.25zm-2.6 4.4c-.15 0-.4.06-.6.28-.21.22-.8.78-.8 1.9s.82 2.2.93 2.36c.12.15 1.6 2.44 3.87 3.42.54.23.96.37 1.29.48.54.17 1.04.15 1.43.09.43-.06 1.34-.55 1.53-1.08.19-.53.19-.98.13-1.08-.06-.09-.21-.15-.43-.27-.22-.11-1.34-.66-1.55-.73-.2-.08-.36-.11-.5.11-.15.22-.58.73-.71.88-.13.15-.26.17-.48.06-.22-.11-.94-.35-1.79-1.11-.66-.59-1.11-1.32-1.24-1.54-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.08-.15.04-.28-.02-.39-.06-.11-.5-1.2-.68-1.65-.18-.43-.36-.37-.5-.38h-.43z" />
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
function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
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
function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 11.001-4.121A2.06 2.06 0 015.34 7.43zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
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
function TwitterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}
