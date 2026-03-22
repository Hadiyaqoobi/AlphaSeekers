import type { ReactNode } from "react";

import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "@/components/logout-button";
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
        { href: `/${locale}/login`, label: t("login") },
        { href: `/${locale}/register`, label: t("register") },
      ]
      : []),
  ];

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div
        className="min-h-screen bg-[#fafafa] text-slate-900"
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

        {/* Top accent line */}
        <div className="h-0.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600" />

        <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-6">
              <Link className="flex items-center gap-2 text-lg font-bold text-slate-900" href={`/${locale}`}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white shadow-sm">A</span>
                <span>AlphaSeekers</span>
              </Link>

              <nav className="hidden md:flex md:gap-0.5">
                {navItems.filter(item => !item.href.includes('login') && !item.href.includes('register')).map((item) => (
                  <Link
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-emerald-50/60 hover:text-emerald-800"
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {!user && (
                <div className="hidden sm:flex sm:items-center sm:gap-3">
                  <Link
                    className="text-sm font-medium text-slate-600 transition-colors hover:text-emerald-700"
                    href={`/${locale}/login`}
                  >
                    {t("login")}
                  </Link>
                  <Link
                    className="btn-primary px-4 py-1.5 text-sm"
                    href={`/${locale}/register`}
                  >
                    {t("register")}
                  </Link>
                </div>
              )}
              {user && (
                <div className="hidden sm:flex sm:items-center sm:gap-3">
                  <Link
                    className="text-sm font-medium text-slate-700 transition-colors hover:text-emerald-700"
                    href={`/${locale}/profile`}
                  >
                    {user.name}
                  </Link>
                  <LogoutButton callbackUrl={`/${locale}/login`} label={t("logout")} variant="nav" />
                </div>
              )}
              <LocaleSwitcher currentLocale={typedLocale} />
            </div>
          </div>

          {/* Mobile Nav */}
          <div className="border-t border-slate-100 md:hidden">
            <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 no-scrollbar">
              {navItems.map((item) => (
                <Link
                  className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors active:bg-emerald-50"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main id="main-content">{children}</main>
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Analytics />
      </div>
    </NextIntlClientProvider>
  );
}
