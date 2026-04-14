'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

type HeroProps = {
  locale: string;
  signedIn: boolean;
  studentLabel: string;
  teacherLabel: string;
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
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
  hidden: { opacity: 0, scale: 0.9 },
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

export function Hero({ locale, signedIn, studentLabel, teacherLabel }: HeroProps) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-land-dark">
      {/* === Background layers for cinematic depth === */}

      {/* Gradient blobs */}
      <div
        className="absolute rounded-full blur-[150px] opacity-25"
        style={{ width: 600, height: 600, top: '20%', left: '70%', background: 'radial-gradient(circle, #064D27 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute rounded-full blur-[120px] opacity-15"
        style={{ width: 500, height: 500, top: '80%', left: '20%', background: 'radial-gradient(circle, #0A6B36 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
        aria-hidden="true"
      />

      {/* Floating atmosphere dots */}
      {[
        { top: '15%', left: '10%', size: 3, delay: '0s' },
        { top: '25%', left: '85%', size: 2, delay: '2s' },
        { top: '60%', left: '5%', size: 4, delay: '1s' },
        { top: '75%', left: '90%', size: 2, delay: '3s' },
        { top: '40%', left: '50%', size: 3, delay: '1.5s' },
        { top: '85%', left: '40%', size: 2, delay: '2.5s' },
      ].map((dot, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white/[0.05] animate-[float-gentle_6s_ease-in-out_infinite]"
          style={{
            top: dot.top,
            left: dot.left,
            width: dot.size,
            height: dot.size,
            animationDelay: dot.delay,
          }}
          aria-hidden="true"
        />
      ))}

      {/* === Content === */}
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center min-h-screen">

        {/* Left column — text */}
        <div className="max-w-xl">
          {/* Pill badge */}
          <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp}>
            <span className="inline-flex items-center gap-2.5 rounded-full bg-land-green-600/15 border border-land-green-500/25 px-5 py-2 text-sm font-medium text-land-green-300">
              <span className="flex h-2 w-2 rounded-full bg-land-green-400 animate-[pulse-soft_2s_ease-in-out_infinite]" />
              Free education for Afghan girls
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.05]"
            style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
          >
            Every Afghan girl{' '}
            <br className="hidden sm:block" />
            deserves to{' '}
            <span className="relative inline-block">
              <span className="text-land-green-400">learn</span>
              {/* Animated underline */}
              <span
                className="absolute -bottom-1 left-0 w-full h-[3px] bg-land-amber origin-left"
                style={{
                  animation: 'underline-draw 0.8s cubic-bezier(0.25,0.46,0.45,0.94) 1.2s forwards',
                  transform: 'scaleX(0)',
                }}
              />
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="mt-7 text-lg lg:text-xl text-white/55 max-w-xl leading-relaxed"
          >
            Free online classes for Afghan girls, taught by volunteer teachers from around the world. Powered by AI. Built for low-bandwidth connections.
          </motion.p>

          {/* CTA buttons */}
          <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp} className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              href={signedIn ? `/${locale}/dashboard` : `/${locale}/register`}
              className="group inline-flex items-center justify-center gap-3 py-4 px-8 rounded-xl bg-land-green-600 text-white text-base font-semibold transition-all duration-200 hover:bg-land-green-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-land-green-600/25 active:translate-y-0"
            >
              {signedIn ? 'Dashboard' : studentLabel}
              <svg className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
            </Link>
            <Link
              href={signedIn ? `/${locale}/teacher/availability` : `/${locale}/register`}
              className="inline-flex items-center justify-center gap-3 py-4 px-8 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white text-base font-semibold transition-all duration-200 hover:bg-white/[0.12] hover:-translate-y-0.5 active:translate-y-0"
            >
              {teacherLabel}
            </Link>
          </motion.div>

          {/* Trust strip */}
          <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp} className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
            {[
              { label: '100% Free', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
              { label: 'Safe & Private', icon: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z' },
              { label: 'Works Offline', icon: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3' },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-2 text-sm text-white/40">
                <svg className="w-4 h-4 text-land-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                {item.label}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right column — hero visual */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={scaleIn}
          className="relative mt-16 lg:mt-0"
        >
          {/* Main image */}
          <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-2xl shadow-black/30">
            <Image
              src="/images/hero-student.jpg"
              alt="Young Afghan woman studying with a laptop"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-land-dark/30 via-transparent to-transparent" />
          </div>

          {/* Floating card — top right */}
          <div
            className="absolute -top-4 -right-4 lg:-right-8 bg-white rounded-xl shadow-2xl p-4 z-10"
            style={{ animation: 'float-gentle 4s ease-in-out infinite' }}
          >
            <p className="text-sm font-bold text-gray-900">Worldwide</p>
            <p className="text-xs text-gray-400">volunteer teachers</p>
          </div>

          {/* Floating card — bottom left */}
          <div
            className="absolute -bottom-2 -left-4 lg:-left-8 bg-white rounded-xl shadow-2xl p-4 flex items-center gap-3 z-10"
            style={{ animation: 'float-gentle 4s ease-in-out 1.5s infinite' }}
          >
            <div className="flex -space-x-2">
              <span className="w-8 h-8 rounded-full bg-land-green-100 border-2 border-white flex items-center justify-center text-xs font-bold text-land-green-700">F</span>
              <span className="w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-xs font-bold text-amber-700">Z</span>
              <span className="w-8 h-8 rounded-full bg-sky-100 border-2 border-white flex items-center justify-center text-xs font-bold text-sky-700">M</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Growing community</p>
              <p className="text-xs text-gray-400">students across Afghanistan</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-[float-gentle_2s_ease-in-out_infinite]">
        <div className="w-[1px] h-8 bg-gradient-to-b from-transparent via-white/30 to-white/10" />
      </div>
    </section>
  );
}
