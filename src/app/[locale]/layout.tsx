import type { ReactNode } from "react";

import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/public/mobile-nav";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { routing } from "@/i18n/routing";
import { isRtlLocale, type Locale } from "@/lib/i18n";
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
  const typedLocale = locale as Locale;

  const navItems = [
    { href: `/${locale}`, label: t("home") },
    ...(user
      ? [
        { href: `/${locale}/classes`, label: t("classes") },
        { href: `/${locale}/webinars`, label: t("webinars") },
        { href: `/${locale}/opportunities`, label: t("opportunities") },
        { href: `/${locale}/library`, label: t("library") },
        { href: `/${locale}/study-assistant`, label: t("aiTutor") },
        { href: `/${locale}/dashboard`, label: t("dashboard") },
        { href: `/${locale}/profile`, label: t("profile") },
      ]
      : []),
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
        className="min-h-screen text-slate-900"
        style={{ backgroundColor: "var(--bg-base)" }}
        data-locale={locale}
        dir={isRtlLocale(typedLocale) ? "rtl" : "ltr"}
        lang={locale}
      >
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-emerald-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          href="#main-content"
        >
          Skip to content
        </a>

        <div id="layout-chrome">
        {/* Top accent line */}
        <div className="h-[3px] bg-gradient-to-r from-brand-500 via-highlight-500 to-accent-400" />

        {/* ───── FULL-WIDTH NAVBAR ───── */}
        <header className="navbar-outer navbar-solid">
          <div className="navbar-inner">
            {/* Logo */}
            <Link
              className="flex items-center gap-3 text-lg font-bold text-slate-900 transition-opacity hover:opacity-80"
              href={`/${locale}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white shadow-md shadow-brand-500/20">
                A
              </span>
              <span className="hidden sm:inline font-display text-xl tracking-tight">AlphaSeekers</span>
            </Link>

            {/* Desktop Nav — centered */}
            <nav className="hidden lg:flex lg:items-center lg:gap-1">
              {navItems.map((item) => (
                <Link
                  className="rounded-lg px-3.5 py-2.5 text-[0.9rem] font-medium text-slate-600 transition-all duration-200 hover:bg-brand-50 hover:text-brand-600"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Desktop Right Side */}
            <div className="flex items-center gap-3">
              {!user && (
                <div className="hidden lg:flex lg:items-center lg:gap-3">
                  <Link
                    className="rounded-lg px-4 py-2.5 text-[0.9rem] font-medium text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900"
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
              )}
              {user && (
                <div className="hidden lg:flex lg:items-center lg:gap-3">
                  <Link
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-100 hover:text-brand-600"
                    href={`/${locale}/profile`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                      {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </span>
                    {user.name}
                  </Link>
                  <LogoutButton callbackUrl={`/${locale}/login`} label={t("logout")} variant="nav" />
                </div>
              )}
              <LocaleSwitcher currentLocale={typedLocale} />

              {/* Mobile hamburger */}
              <MobileNav
                authItems={authItems}
                navItems={navItems}
                user={user ? { name: user.name ?? "User" } : null}
                logoutCallbackUrl={`/${locale}/login`}
                logoutLabel={user ? t("logout") : ""}
              />
            </div>
          </div>
        </header>
        </div>

        <main id="main-content">{children}</main>
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Analytics />
      </div>
    </NextIntlClientProvider>
  );
}
