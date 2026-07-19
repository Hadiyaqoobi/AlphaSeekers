import type { ReactNode } from "react";

import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Sidebar } from "@/components/admin/sidebar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { MustChangePasswordBanner } from "@/components/must-change-password-banner";
import { MobileNav } from "@/components/public/mobile-nav";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { routing } from "@/i18n/routing";
import { isRtlLocale, type Locale } from "@/lib/i18n";
import { getAccessControl } from "@/lib/security/permissions";
import { getSessionUser } from "@/lib/security/session";
import { Analytics } from "@vercel/analytics/react";

type LocaleLayoutProps = {
  children: ReactNode;
  params: { locale: string };
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: "nav" });
  const user = await getSessionUser();
  const access = user ? await getAccessControl() : null;
  const typedLocale = locale as Locale;

  const navItems = [
    { href: `/${locale}`, label: t("home") },
    ...(user
      ? [
        { href: `/${locale}/classes`, label: t("classes") },
        { href: `/${locale}/study-assistant`, label: t("aiTutor") },
        { href: `/${locale}/dashboard`, label: t("dashboard") },
        { href: `/${locale}/profile`, label: t("profile") },
      ]
      : []),
    { href: `/${locale}/webinars`, label: t("webinars") },
    { href: `/${locale}/library`, label: t("library") },
    { href: `/${locale}/opportunities`, label: t("opportunities") },
    ...(user && (user.role === "TEACHER" || user.role === "ADMIN")
      ? [{ href: `/${locale}/teacher/availability`, label: t("teacher") }]
      : []),
    ...(user && user.role === "ADMIN"
      ? [
        { href: `/${locale}/staff/dashboard`, label: t("staff") },
        { href: `/${locale}/admin/classes`, label: t("admin") },
        { href: `/${locale}/admin/users`, label: t("users") },
      ]
      : []),
    { href: `/${locale}/team`, label: t("team") },
    ...(!user
      ? [
        { href: `/${locale}#programs`, label: t("programs") },
        { href: `/${locale}#how-it-works`, label: t("howItWorks") },
      ]
      : []),
  ];

  const authItems = !user
    ? [
      { href: `/${locale}/login`, label: t("login"), variant: "link" as const },
      { href: `/${locale}/register`, label: t("register"), variant: "primary" as const },
    ]
    : [];

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div
        className="min-h-screen text-ink-main"
        style={{ backgroundColor: "var(--bg-base)" }}
        data-locale={locale}
        dir={isRtlLocale(typedLocale) ? "rtl" : "ltr"}
        lang={locale}
      >
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-neon-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          href="#main-content"
        >
          Skip to content
        </a>

        {user ? (
          /* ── Authenticated: sidebar + utility header ── */
          <div className="flex min-h-screen">
            <Sidebar
              locale={locale}
              userName={user.name ?? "User"}
              userRole={user.role}
              userEmail={user.email}
              isSuper={access?.isSuper ?? false}
              permissions={access ? Array.from(access.permissions) : []}
              unrestricted={access?.unrestricted ?? false}
            />
            <div className="flex-1 min-w-0 flex flex-col">
              <header
                className="h-14 flex items-center justify-between px-6 flex-shrink-0"
                style={{ background: '#0A1118', borderBottom: '1px solid #1A2D3D' }}
              >
                <div />
                <div className="flex items-center gap-4">
                  <LocaleSwitcher currentLocale={typedLocale} />
                  <span className="text-sm hidden sm:inline" style={{ color: '#8899A6' }}>{user.name}</span>
                </div>
              </header>
              {access?.mustChangePassword ? <MustChangePasswordBanner locale={locale} /> : null}
              <main id="main-content" className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        ) : (
          /* ── Public: top nav ── */
          <>
            <div id="layout-chrome">
              <div className="h-[3px] bg-gradient-to-r from-brand-500 via-highlight-500 to-accent-400" />
              <header className="navbar-outer navbar-solid">
                <div className="navbar-inner">
                  <Link
                    className="flex items-center gap-3 text-lg font-bold text-ink-main transition-opacity hover:opacity-80"
                    href={`/${locale}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo/wordmark-192.png"
                      alt="AlphaSeekers"
                      width={76}
                      height={60}
                    />
                  </Link>

                  <nav className="hidden lg:flex lg:items-center lg:gap-1">
                    {navItems.map((item) => (
                      <Link
                        className="rounded-lg px-3.5 py-2.5 text-[0.9rem] font-medium text-ink-soft transition-all duration-200 hover:bg-brand-50 hover:text-brand-600"
                        href={item.href}
                        key={item.href}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="flex items-center gap-3">
                    <div className="hidden lg:flex lg:items-center lg:gap-3">
                      <Link
                        className="rounded-lg px-4 py-2.5 text-[0.9rem] font-medium text-ink-soft transition-all duration-200 hover:bg-dark-100 hover:text-ink-main"
                        href={`/${locale}/login`}
                      >
                        {t("login")}
                      </Link>
                      <Link
                        className="btn-primary px-6 py-2.5 text-sm"
                        href={`/${locale}/register`}
                      >
                        {t("register")}
                      </Link>
                    </div>
                    <LocaleSwitcher currentLocale={typedLocale} />

                    <MobileNav
                      authItems={authItems}
                      navItems={navItems}
                      user={null}
                      logoutCallbackUrl={`/${locale}/login`}
                      logoutLabel=""
                    />
                  </div>
                </div>
              </header>
            </div>
            <main id="main-content">{children}</main>
          </>
        )}
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Analytics />
      </div>
    </NextIntlClientProvider>
  );
}
