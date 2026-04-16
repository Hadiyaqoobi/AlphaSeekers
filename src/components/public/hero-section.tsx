"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type HeroSectionProps = { signedIn: boolean };

const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.88 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.5 + i * 0.15,
      duration: 0.6,
      ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
    },
  }),
};

export function HeroSection({ signedIn }: HeroSectionProps) {
  const t = useTranslations("home");
  const navT = useTranslations("nav");
  const locale = useLocale();

  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const heroImageY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section ref={containerRef} className="relative w-full overflow-hidden">
      {/* Full-bleed gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50 via-white to-surface-base" aria-hidden="true" />

      {/* Decorative background shapes */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-100/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 animate-float-slow" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent-100/40 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" aria-hidden="true" style={{ animationDelay: "5s" }} />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-highlight-100/30 rounded-full blur-[80px]" aria-hidden="true" />

      {/* Subtle dot pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #0E7C6B 1px, transparent 1px)', backgroundSize: '32px 32px' }} aria-hidden="true" />

      {/* Content */}
      <div className="relative w-full max-w-[1400px] mx-auto px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* TEXT */}
          <div className="max-w-2xl">
            {/* Badge */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="inline-flex items-center gap-2.5 rounded-full bg-dark-100/80 backdrop-blur-sm border border-brand-200/60 px-5 py-2.5 shadow-sm mb-8"
            >
              <span className="flex h-2.5 w-2.5 rounded-full bg-brand-500 animate-pulse-soft" />
              <span className="text-sm font-semibold text-brand-600">{t("eyebrow")}</span>
            </motion.div>

            <motion.h1
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="text-[2.75rem] sm:text-5xl lg:text-[3.75rem] xl:text-[4rem] font-extrabold leading-[1.05] tracking-tight text-ink-main font-display"
            >
              {t("hero.headline1")}{" "}
              <br className="hidden sm:block" />
              {t("hero.headline2")}{" "}
              <span className="relative inline-block">
                <span className="text-brand-500">{t("hero.highlightWord")}</span>
                <svg
                  className="absolute -bottom-2 left-0 w-full h-4 text-accent-400"
                  viewBox="0 0 120 14"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2,10 Q30,2 60,8 T118,6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="hero-underline-draw"
                  />
                </svg>
              </span>
            </motion.h1>

            <motion.p
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="mt-7 text-lg lg:text-xl text-ink-soft leading-relaxed max-w-lg"
            >
              {t("subtitle")}
            </motion.p>

            {/* Role CTAs — 3D Tactile Style */}
            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="mt-10"
            >
              <p className="text-xs font-bold text-ink-faint uppercase tracking-widest mb-4">{t("hero.getStarted")}</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={signedIn ? `/${locale}/dashboard` : `/${locale}/register`}
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-brand-500 text-white text-[15px] font-bold shadow-[0_4px_0_0_#0A5F53] hover:shadow-[0_4px_0_0_#0A5F53,0_6px_20px_rgba(14,124,107,0.3)] hover:-translate-y-1 active:translate-y-[2px] active:shadow-[0_1px_0_0_#0A5F53] transition-all duration-200"
                >
                  <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" /></svg>
                  {signedIn ? navT("dashboard") : t("hero.imStudent")}
                  <svg className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                </Link>
                <Link
                  href={signedIn ? `/${locale}/teacher/availability` : `/${locale}/register`}
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-dark-100 text-ink-main text-[15px] font-bold border-2 border-line shadow-[0_4px_0_0_#E5DFD6] hover:border-brand-300 hover:text-brand-600 hover:shadow-[0_4px_0_0_#E5DFD6,0_6px_20px_rgba(14,124,107,0.1)] hover:-translate-y-1 active:translate-y-[2px] active:shadow-[0_1px_0_0_#E5DFD6] transition-all duration-200"
                >
                  <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                  {t("hero.imTeacher")}
                </Link>
              </div>
              {!signedIn && (
                <p className="mt-5 text-sm text-ink-faint">
                  {t("hero.alreadyHaveAccount")}{" "}
                  <Link href={`/${locale}/login`} className="text-brand-500 font-semibold hover:text-brand-600 underline underline-offset-2 decoration-brand-200 hover:decoration-brand-400 transition-colors">
                    {navT("login")}
                  </Link>
                </p>
              )}
            </motion.div>

            {/* Trust row */}
            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="mt-10 pt-8 border-t border-line-soft flex flex-wrap gap-x-8 gap-y-3"
            >
              {[
                { label: t("hero.trustFree"), icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
                { label: t("hero.trustSafe"), icon: "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" },
                { label: t("hero.trustOffline"), icon: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 text-sm text-ink-soft">
                  <svg className="w-4.5 h-4.5 text-brand-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                  {item.label}
                </div>
              ))}
            </motion.div>
          </div>

          {/* IMAGE */}
          <div className="relative lg:ml-auto">
            {/* Main image */}
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={scaleIn}
              style={{ y: heroImageY }}
              className="relative rounded-2xl overflow-hidden shadow-2xl shadow-brand-900/10 ring-1 ring-brand-900/5"
            >
              <Image
                src="/images/hero-student.jpg"
                alt="Young woman in hijab studying with a laptop"
                width={640}
                height={427}
                priority
                className="w-full h-auto object-cover"
              />
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-brand-900/15 via-transparent to-transparent" aria-hidden="true" />
            </motion.div>

            {/* Floating student count card — with continuous float */}
            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={scaleIn}
              className="absolute -bottom-6 -left-4 sm:left-4 bg-dark-100 rounded-2xl shadow-xl shadow-gray-900/10 border border-line-soft px-5 py-4 flex items-center gap-4 z-10 float-badge"
            >
              <div className="flex -space-x-2.5">
                <span className="w-10 h-10 rounded-full bg-brand-100 border-2 border-white flex items-center justify-center text-xs font-bold text-brand-600">F</span>
                <span className="w-10 h-10 rounded-full bg-highlight-100 border-2 border-white flex items-center justify-center text-xs font-bold text-highlight-600">Z</span>
                <span className="w-10 h-10 rounded-full bg-accent-100 border-2 border-white flex items-center justify-center text-xs font-bold text-accent-600">M</span>
                <span className="w-10 h-10 rounded-full bg-sky-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-sky-700">+497</span>
              </div>
              <div>
                <p className="text-sm font-bold text-ink-main">{t("hero.students")}</p>
                <p className="text-xs text-ink-faint">{t("hero.studentsSubtext")}</p>
              </div>
            </motion.div>

            {/* Floating badge top-right — countries */}
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={scaleIn}
              className="absolute -top-3 -right-3 sm:right-4 bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-xl px-5 py-3 shadow-lg shadow-brand-600/30 z-10 float-badge-delay"
            >
              <p className="text-sm font-bold">{t("hero.countries")}</p>
              <p className="text-[11px] opacity-80">{t("hero.countriesSubtext")}</p>
            </motion.div>

            {/* Secondary image — small */}
            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={scaleIn}
              className="absolute -bottom-6 -right-4 sm:-right-6 w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden shadow-lg ring-4 ring-white z-10 hidden md:block"
            >
              <Image
                src="/images/hero-hijab-2.jpg"
                alt="Student learning from home"
                width={160}
                height={160}
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
