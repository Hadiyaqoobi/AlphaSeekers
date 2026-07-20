'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';

// ──────────────────────────────────────────────
// Dark CSS mockups — one per feature tab
// ──────────────────────────────────────────────

function BrowserShell({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-dark-100 border border-white/[0.06] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_30px_rgba(0,230,118,0.06)]">
      <div className="flex items-center gap-1.5 px-4 py-3 bg-dark-200 border-b border-white/[0.06]">
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="flex-1 mx-3 h-5 rounded bg-white/5 flex items-center justify-center">
          <span className="text-[10px] text-white/30 font-mono">{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function ClassesMockup() {
  const sessions = [
    { name: 'English A2', time: 'Tue · 6:00 PM', accent: 'neon' },
    { name: 'Korean 101', time: 'Wed · 4:00 PM', accent: 'cyan' },
    { name: 'Digital Art', time: 'Thu · 5:30 PM', accent: 'amber' },
  ];
  const accentMap: Record<string, string> = {
    neon: 'bg-[rgba(0,230,118,0.12)] text-[#00E676]',
    cyan: 'bg-[rgba(0,229,255,0.12)] text-[#00E5FF]',
    amber: 'bg-[rgba(255,179,0,0.12)] text-[#FFB300]',
  };
  return (
    <BrowserShell url="alphaseekers.onrender.com/classes">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: '#E8EEF2' }}>This week</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#8AA4B8' }}>3 upcoming sessions</p>
          </div>
          <div
            className="px-3 py-1.5 text-[10px] font-bold rounded-lg"
            style={{ background: '#00E676', color: '#070B0E', boxShadow: '0 0 12px rgba(0,230,118,0.3)' }}
          >
            + New class
          </div>
        </div>
        <div className="space-y-2 mt-4">
          {sessions.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl px-3 py-3"
              style={{ background: '#142230', border: '1px solid #1A2D3D' }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentMap[s.accent]}`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#E8EEF2' }}>{s.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#5A7A94' }}>{s.time}</p>
                </div>
              </div>
              <div
                className="px-2 py-0.5 rounded text-[9px] font-bold"
                style={{ background: '#00E676', color: '#070B0E' }}
              >
                Join
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserShell>
  );
}

function AiChatMockup() {
  return (
    <BrowserShell url="alphaseekers.onrender.com/study-assistant">
      <div className="p-6 space-y-3 min-h-[340px]">
        {/* User bubble — first */}
        <div className="flex justify-end">
          <div
            className="rounded-2xl rounded-tr-sm px-3 py-2 max-w-[75%] text-[10px] font-medium"
            style={{ background: '#00E676', color: '#070B0E', boxShadow: '0 0 16px rgba(0,230,118,0.2)' }}
          >
            What is photosynthesis?
          </div>
        </div>

        {/* AI response */}
        <div className="flex gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,230,118,0.15)' }}
          >
            <span className="text-[9px] font-bold" style={{ color: '#00E676' }}>AI</span>
          </div>
          <div
            className="rounded-2xl rounded-tl-sm px-3 py-2 max-w-[80%]"
            style={{ background: '#142230', border: '1px solid #1A2D3D' }}
          >
            <span
              className="inline-block px-1.5 py-0.5 mb-1.5 text-[8px] font-semibold rounded"
              style={{ background: 'rgba(0,230,118,0.12)', color: '#00E676' }}
            >
              📚 Study mode
            </span>
            <p className="text-[10px] leading-relaxed" style={{ color: '#C0CCD6' }}>
              Photosynthesis is how plants convert sunlight into energy. Chlorophyll absorbs light, then water and CO₂ become glucose + oxygen.
            </p>
            <div className="flex gap-1.5 mt-2">
              <span
                className="text-[8px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'rgba(0,230,118,0.10)', color: '#00E676' }}
              >
                Chapter 3
              </span>
              <span
                className="text-[8px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF' }}
              >
                Vocab list
              </span>
            </div>
          </div>
        </div>

        {/* Follow-up user message */}
        <div className="flex justify-end">
          <div
            className="rounded-2xl rounded-tr-sm px-3 py-2 max-w-[60%] text-[10px] font-medium"
            style={{ background: '#00E676', color: '#070B0E' }}
          >
            Quiz me on this
          </div>
        </div>

        {/* Input bar */}
        <div className="mt-4 flex items-center gap-2">
          <div
            className="flex-1 h-9 rounded-lg px-3 flex items-center"
            style={{ background: '#1A2D3D' }}
          >
            <span className="text-[9px]" style={{ color: '#5A7A94' }}>Ask the AI tutor...</span>
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: '#00E676', boxShadow: '0 0 12px rgba(0,230,118,0.3)' }}
          >
            <svg className="w-4 h-4" style={{ color: '#070B0E' }} fill="currentColor" viewBox="0 0 20 20">
              <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.289z" />
            </svg>
          </div>
        </div>
      </div>
    </BrowserShell>
  );
}

function OpportunitiesMockup() {
  const opps = [
    {
      type: 'Scholarship',
      title: 'STEM Scholarship 2026',
      desc: 'Full tuition + $5k stipend',
      deadline: 'May 15',
      bg: 'rgba(0,230,118,0.10)',
      color: '#00E676',
    },
    {
      type: 'Internship',
      title: 'Google Summer of Code',
      desc: 'Remote, 12 weeks, paid',
      deadline: 'Apr 30',
      bg: 'rgba(0,229,255,0.10)',
      color: '#00E5FF',
    },
    {
      type: 'Grant',
      title: 'Malala Fund Education Grant',
      desc: 'For Afghan girls in tech',
      deadline: 'Jun 1',
      bg: 'rgba(255,179,0,0.10)',
      color: '#FFB300',
    },
    {
      type: 'Job',
      title: 'Junior Frontend Engineer',
      desc: 'Remote · $40k–60k/yr',
      deadline: 'Open',
      bg: 'rgba(41,121,255,0.10)',
      color: '#2979FF',
    },
  ];
  return (
    <BrowserShell url="alphaseekers.onrender.com/opportunities">
      <div className="p-6 space-y-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#E8EEF2' }}>Open opportunities</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#8AA4B8' }}>Curated for Afghan students worldwide</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {opps.map((o, i) => (
            <div
              key={i}
              className="rounded-xl p-3"
              style={{ background: '#142230', border: '1px solid #1A2D3D' }}
            >
              <span
                className="inline-block text-[9px] px-1.5 py-0.5 rounded font-semibold mb-2"
                style={{ background: o.bg, color: o.color }}
              >
                {o.type}
              </span>
              <p className="text-[10px] font-medium leading-tight" style={{ color: '#E8EEF2' }}>
                {o.title}
              </p>
              <p className="text-[9px] mt-1 leading-relaxed" style={{ color: '#5A7A94' }}>
                {o.desc}
              </p>
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-[9px]" style={{ color: '#8AA4B8' }}>
                  Due: {o.deadline}
                </span>
                <span className="text-[9px] font-semibold" style={{ color: '#00E676' }}>
                  View →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserShell>
  );
}

function OfflineMockup() {
  const cachedClasses = [
    { name: 'English A2', time: 'Today · 6:00 PM' },
    { name: 'Korean 101', time: 'Tomorrow · 4:00 PM' },
    { name: 'Digital Art', time: 'Thu · 5:30 PM' },
  ];
  return (
    <BrowserShell url="alphaseekers.onrender.com/dashboard">
      <div className="p-6 min-h-[340px] flex items-center justify-center">
        <div className="relative">
          {/* Soft glow behind card */}
          <div className="absolute -inset-6 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,230,118,0.18)_0%,transparent_70%)] pointer-events-none" />

          {/* Phone-style card */}
          <div
            className="relative rounded-2xl p-4 w-52 mx-auto"
            style={{
              background: '#142230',
              border: '1px solid #1A2D3D',
              boxShadow: '0 0 30px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: '#E8EEF2' }}>
                My schedule
              </span>
              <span
                className="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: 'rgba(255,179,0,0.15)', color: '#FFB300' }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: '#FFB300' }} />
                Offline
              </span>
            </div>

            {/* Cached schedule items */}
            <div className="space-y-1.5">
              {cachedClasses.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg p-2"
                  style={{ background: '#1A2D3D' }}
                >
                  <p className="text-[9px] font-medium" style={{ color: '#E8EEF2' }}>
                    {c.name}
                  </p>
                  <p className="text-[8px] mt-0.5" style={{ color: '#8AA4B8' }}>
                    {c.time}
                  </p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid #1A2D3D' }}>
              <div className="flex items-center justify-center gap-1">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#5A7A94' }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                </svg>
                <span className="text-[8px]" style={{ color: '#5A7A94' }}>
                  Last synced: 2h ago
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BrowserShell>
  );
}

const TAB_MOCKUPS = [ClassesMockup, AiChatMockup, OpportunitiesMockup, OfflineMockup];

export function FeatureTabs() {
  const t = useTranslations('landing');
  const [activeTab, setActiveTab] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const lastInteraction = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const tabs = TAB_MOCKUPS.map((Mockup, i) => ({
    Mockup,
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
  }, [isPaused, tabs.length]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <section
      className="relative w-full py-20 lg:py-28 overflow-hidden"
      id="programs"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => { if (Date.now() - lastInteraction.current > 10000) setIsPaused(false); }}
    >
      {/* Section ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(0,229,255,0.05)_0%,transparent_60%)] pointer-events-none" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-[0.15em] text-neon-500 font-medium mb-4">{t('features.kicker')}</p>
          <h2 className="text-3xl lg:text-5xl font-bold text-white tracking-tight mb-4" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t('features.title')}</h2>
          <p className="text-lg text-white/45 max-w-xl mx-auto">{t('features.subtitle')}</p>
        </div>

        <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-12">
          {/* Tab list */}
          <div className="space-y-2 mb-8 lg:mb-0">
            {tabs.map((tab, i) => {
              const ActiveMockup = tab.Mockup;
              return (
                <button
                  key={tab.title}
                  onClick={() => handleTabClick(i)}
                  className={`w-full text-left transition-all duration-300 rounded-xl ${
                    activeTab === i
                      ? 'border-l-[3px] border-neon-500 bg-neon-500/[0.06] pl-5 py-5 pr-4'
                      : 'border-l-[3px] border-transparent pl-5 py-4 pr-4 cursor-pointer hover:bg-white/[0.03]'
                  }`}
                >
                  <p className={`text-sm font-semibold transition-colors ${activeTab === i ? 'text-white' : 'text-white/55'}`}>
                    {tab.title}
                  </p>
                  <div style={{ maxHeight: activeTab === i ? '600px' : '0', opacity: activeTab === i ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s' }}>
                    <p className="text-sm text-white/45 leading-relaxed mt-2">{tab.desc}</p>
                    {/* Mobile preview */}
                    <div className="mt-4 lg:hidden">
                      <ActiveMockup />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop preview */}
          <div className="hidden lg:block relative min-h-[400px]">
            {tabs.map((tab, i) => {
              const Mockup = tab.Mockup;
              return (
                <div
                  key={i}
                  className="absolute inset-0 transition-all duration-400"
                  style={{
                    opacity: activeTab === i ? 1 : 0,
                    transform: activeTab === i ? 'scale(1)' : 'scale(0.98)',
                    pointerEvents: activeTab === i ? 'auto' : 'none',
                    zIndex: activeTab === i ? 1 : 0,
                  }}
                >
                  <Mockup />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom glow divider */}
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 mt-20">
        <div className="h-px bg-gradient-to-r from-transparent via-neon-500/30 to-transparent" />
      </div>
    </section>
  );
}
