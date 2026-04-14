'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const tabs = [
  {
    title: 'Live classes via Google Meet',
    desc: 'Students join live classes taught by volunteer teachers across multiple time zones. WhatsApp reminders ensure nobody misses a session. One tap from the dashboard opens Google Meet directly.',
    gradient: 'from-land-green-800 to-land-green-950',
    placeholder: '[ Class dashboard screenshot ]',
  },
  {
    title: 'AI study assistant',
    desc: 'A bilingual AI tutor that answers student questions using actual course materials. Powered by a RAG pipeline with vector search, it responds in Dari or English and streams answers in real-time. Built to work on 2G connections.',
    gradient: 'from-land-dark to-land-green-900',
    placeholder: '[ AI chat interface screenshot ]',
  },
  {
    title: 'Opportunities & library',
    desc: 'Browse curated scholarships, internships, and grants. Download free reading materials as PDFs for offline study during power outages.',
    gradient: 'from-land-amber/30 to-land-green-900',
    placeholder: '[ Opportunities page screenshot ]',
  },
  {
    title: 'Offline-first design',
    desc: 'Class schedules are cached locally. Forms auto-save during power outages. The entire platform works on a 2G connection with a $50 Android phone. Every kilobyte is accounted for.',
    gradient: 'from-land-green-950 to-land-dark',
    placeholder: '[ Offline schedule view screenshot ]',
  },
];

export function FeatureTabs() {
  const [activeTab, setActiveTab] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const lastInteraction = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleTabClick = useCallback((index: number) => {
    setActiveTab(index);
    setIsPaused(true);
    lastInteraction.current = Date.now();

    // Resume auto-rotation after 10s of no interaction
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsPaused(false), 10000);
  }, []);

  // Auto-rotation
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % tabs.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <section
      className="w-full py-24 bg-land-cream"
      id="programs"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        if (Date.now() - lastInteraction.current > 10000) setIsPaused(false);
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-land-green-600 text-sm font-semibold uppercase tracking-[0.15em] mb-4">
            Platform
          </p>
          <h2
            className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-4"
            style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
          >
            Built for learning, designed for Afghanistan
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Every feature exists because a real student needed it.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-12">
          {/* Left — tabs */}
          <div className="space-y-2 mb-8 lg:mb-0">
            {tabs.map((tab, i) => (
              <button
                key={tab.title}
                onClick={() => handleTabClick(i)}
                className={`w-full text-left transition-all duration-300 rounded-xl ${
                  activeTab === i
                    ? 'border-l-[3px] border-land-green-500 bg-land-green-50/60 pl-5 py-5 pr-4'
                    : 'border-l-[3px] border-transparent pl-5 py-4 pr-4 cursor-pointer hover:bg-gray-50'
                }`}
              >
                <p className={`text-sm font-semibold transition-colors ${activeTab === i ? 'text-gray-900' : 'text-gray-600'}`}>
                  {tab.title}
                </p>
                {/* Desktop: show description when active */}
                <AnimatePresence mode="wait">
                  {activeTab === i && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="text-sm text-gray-500 leading-relaxed mt-2 hidden lg:block"
                    >
                      {tab.desc}
                    </motion.p>
                  )}
                </AnimatePresence>
                {/* Mobile: always show description when active (accordion) */}
                <AnimatePresence mode="wait">
                  {activeTab === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="lg:hidden"
                    >
                      <p className="text-sm text-gray-500 leading-relaxed mt-2">{tab.desc}</p>
                      {/* Mobile preview */}
                      <div className={`mt-4 rounded-xl overflow-hidden aspect-[4/3] bg-gradient-to-br ${tab.gradient} flex items-center justify-center`}>
                        <span className="text-white/20 text-sm tracking-widest">{tab.placeholder}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>

          {/* Right — visual preview (desktop only) */}
          <div className="hidden lg:block relative rounded-2xl overflow-hidden aspect-auto min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tabs[activeTab].gradient} flex items-center justify-center`}
              >
                <span className="text-white/20 text-sm tracking-widest">{tabs[activeTab].placeholder}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
