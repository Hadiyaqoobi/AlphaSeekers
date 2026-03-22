"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";

type HeroSectionProps = {
  signedIn: boolean;
};

export function HeroSection({ signedIn }: HeroSectionProps) {
  const t = useTranslations("home");
  const navT = useTranslations("nav");
  const locale = useLocale();

  const primaryCtaHref = signedIn ? `/${locale}/dashboard` : `/${locale}/register`;
  const primaryCtaLabel = signedIn ? navT("dashboard") : navT("register");

  const secondaryCtaHref = signedIn ? `/${locale}/classes` : `/${locale}/login`;
  const secondaryCtaLabel = signedIn ? navT("classes") : navT("login");

  return (
    <header className="hero-gradient -mx-4 sm:-mx-6 px-4 sm:px-6 pt-14 pb-10 sm:pt-20 sm:pb-14 rounded-b-2xl overflow-hidden">
      <div className="relative mx-auto max-w-2xl text-center">
        {/* Decorative dots */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1.5 opacity-40" aria-hidden="true">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-100/70 px-4 py-1.5 text-sm font-semibold text-emerald-800"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {t("eyebrow")}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl leading-tight"
        >
          {t("title")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-5 text-lg text-slate-600 leading-relaxed"
        >
          {t("subtitle")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link className="btn-primary w-full sm:w-auto px-8 py-3" href={primaryCtaHref}>
            {primaryCtaLabel}
          </Link>
          <Link className="btn-secondary w-full sm:w-auto px-8 py-3" href={secondaryCtaHref}>
            {secondaryCtaLabel}
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-9 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500"
        >
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t("pillars.approvedOnly")}
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t("pillars.lowBandwidth")}
          </div>
        </motion.div>
      </div>
    </header>
  );
}
