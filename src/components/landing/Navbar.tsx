'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

type NavbarProps = {
  locale: string;
  signedIn: boolean;
  loginLabel: string;
  registerLabel: string;
};

export function Navbar({ locale, signedIn, loginLabel, registerLabel }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 80);
  });

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mobileOpen]);

  const links = [
    { href: `/${locale}`, label: 'Home' },
    { href: `/${locale}#programs`, label: 'Programs' },
    { href: `/${locale}#how-it-works`, label: 'How It Works' },
    { href: `/${locale}#faq`, label: 'FAQ' },
  ];

  const ctaHref = signedIn ? `/${locale}/dashboard` : `/${locale}/register`;

  return (
    <>
      <header
        className={`landing-nav fixed top-0 left-0 right-0 z-50 h-20 transition-all duration-400 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border-b border-black/[0.04]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8 h-full flex items-center justify-between">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-3 group">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shadow-md transition-all duration-300 ${
                scrolled
                  ? 'bg-gradient-to-br from-land-green-600 to-land-green-700 text-white'
                  : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'
              }`}
            >
              A
            </span>
            <span
              className={`hidden sm:inline text-xl font-extrabold tracking-tight transition-colors duration-300 ${
                scrolled ? 'text-gray-900' : 'text-white'
              }`}
              style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
            >
              AlphaSeekers
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex lg:items-center lg:gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  scrolled
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Right Side */}
          <div className="hidden lg:flex lg:items-center lg:gap-3">
            {!signedIn && (
              <Link
                href={`/${locale}/login`}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  scrolled
                    ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {loginLabel}
              </Link>
            )}
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 bg-land-green-600 text-white rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 hover:bg-land-green-500 hover:scale-[1.03] hover:shadow-lg hover:shadow-land-green-600/25 active:scale-[0.98]"
            >
              {signedIn ? 'Dashboard' : registerLabel}
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="lg:hidden flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <svg
              className={`w-5 h-5 transition-colors duration-300 ${scrolled ? 'text-gray-700' : 'text-white'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMobile}
              aria-hidden="true"
            />
            <motion.div
              className="fixed inset-0 z-[70] bg-land-dark lg:hidden flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              role="dialog"
              aria-modal={true}
              aria-label="Navigation menu"
            >
              {/* Close button */}
              <div className="flex items-center justify-between px-6 h-20">
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-sm font-bold text-white">
                    A
                  </span>
                  <span className="text-xl font-extrabold text-white tracking-tight" style={{ fontFamily: 'var(--font-landing)' }}>
                    AlphaSeekers
                  </span>
                </span>
                <button
                  onClick={closeMobile}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile Nav Links */}
              <nav className="flex-1 flex flex-col justify-center px-8 gap-2">
                {links.map((link, i) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link
                      href={link.href}
                      onClick={closeMobile}
                      className="block py-4 text-2xl font-semibold text-white/80 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Mobile CTA */}
              <div className="px-8 pb-12 space-y-3">
                {!signedIn && (
                  <Link
                    href={`/${locale}/login`}
                    onClick={closeMobile}
                    className="block w-full py-4 text-center rounded-xl border-2 border-white/20 text-white text-base font-semibold hover:bg-white/10 transition-colors"
                  >
                    {loginLabel}
                  </Link>
                )}
                <Link
                  href={ctaHref}
                  onClick={closeMobile}
                  className="block w-full py-4 text-center rounded-xl bg-land-green-600 text-white text-base font-semibold hover:bg-land-green-500 transition-colors"
                >
                  {signedIn ? 'Dashboard' : registerLabel}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
