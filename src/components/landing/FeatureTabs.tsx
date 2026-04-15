'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';

const tabStyles = [
  { gradient: 'from-land-green-800 to-land-green-950', placeholder: '[ Class dashboard screenshot ]' },
  { gradient: 'from-land-dark to-land-green-900', placeholder: '[ AI chat interface screenshot ]' },
  { gradient: 'from-land-amber/30 to-land-green-900', placeholder: '[ Opportunities page screenshot ]' },
  { gradient: 'from-land-green-950 to-land-dark', placeholder: '[ Offline schedule view screenshot ]' },
];

export function FeatureTabs() {
  const t = useTranslations('landing');
  const [activeTab, setActiveTab] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const lastInteraction = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const tabs = tabStyles.map((style, i) => ({
    ...style,
    title: t(`features.tabs.${i}.title`),
    desc: t(`features.tabs.${i}.desc`),
  }));

  const handleTabClick = useCallback((index: number) => {
    setActiveTab(index);
    setIsPaused(true);
    lastInteraction.current = Date.now();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsPaused(false), 10000);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => setActiveTab(prev => (prev + 1) % tabs.length), 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <section className="w-full py-24 bg-land-cream" id="programs" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => { if (Date.now() - lastInteraction.current > 10000) setIsPaused(false); }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-land-green-600 text-sm font-semibold uppercase tracking-[0.15em] mb-4">{t('features.kicker')}</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t('features.title')}</h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">{t('features.subtitle')}</p>
        </div>
        <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-12">
          <div className="space-y-2 mb-8 lg:mb-0">
            {tabs.map((tab, i) => (
              <button key={tab.title} onClick={() => handleTabClick(i)} className={`w-full text-left transition-all duration-300 rounded-xl ${activeTab === i ? 'border-l-[3px] border-land-green-500 bg-land-green-50/60 pl-5 py-5 pr-4' : 'border-l-[3px] border-transparent pl-5 py-4 pr-4 cursor-pointer hover:bg-gray-50'}`}>
                <p className={`text-sm font-semibold transition-colors ${activeTab === i ? 'text-gray-900' : 'text-gray-600'}`}>{tab.title}</p>
                {/* Description expands/collapses */}
                <div style={{ maxHeight: activeTab === i ? '200px' : '0', opacity: activeTab === i ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s' }}>
                  <p className="text-sm text-gray-500 leading-relaxed mt-2">{tab.desc}</p>
                  {/* Mobile preview */}
                  <div className={`mt-4 rounded-xl overflow-hidden aspect-[4/3] bg-gradient-to-br ${tab.gradient} flex items-center justify-center lg:hidden`}>
                    <span className="text-white/20 text-sm tracking-widest">{tab.placeholder}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Desktop preview */}
          <div className="hidden lg:block relative rounded-2xl overflow-hidden min-h-[400px]">
            {tabs.map((tab, i) => (
              <div key={i} className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center transition-all duration-400`} style={{ opacity: activeTab === i ? 1 : 0, transform: activeTab === i ? 'scale(1)' : 'scale(0.98)', zIndex: activeTab === i ? 1 : 0 }}>
                <span className="text-white/20 text-sm tracking-widest">{tab.placeholder}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
