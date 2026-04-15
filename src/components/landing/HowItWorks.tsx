'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const steps = [
  {
    num: '1',
    title: 'Request access',
    desc: 'Sign up as a student or volunteer teacher. Your account is reviewed to keep the community safe.',
  },
  {
    num: '2',
    title: 'Browse and enroll',
    desc: 'Explore classes in languages, arts, and professional skills. Enroll in any class with one tap.',
  },
  {
    num: '3',
    title: 'Join live classes',
    desc: 'Get a WhatsApp reminder before each session. Tap to join Google Meet directly from your phone.',
  },
];

export function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section className="w-full py-24 bg-land-sage" id="how-it-works" ref={ref}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16 lg:text-left"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-land-green-600 text-sm font-semibold uppercase tracking-[0.15em] mb-4">
            How It Works
          </p>
          <h2
            className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-4"
            style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
          >
            Start learning in three steps
          </h2>
          <p className="text-lg text-gray-500 max-w-lg">
            No fees, no complicated setup. Just sign up and join a class.
          </p>
        </motion.div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Left — steps (reveal one at a time) */}
          <div className="space-y-0">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                className="flex items-start gap-5"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex flex-col items-center">
                  {/* Number circle with scale bounce */}
                  <motion.div
                    className="w-10 h-10 rounded-full bg-land-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0"
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: [0, 1.15, 1] } : {}}
                    transition={{
                      delay: 0.2 + i * 0.3,
                      duration: 0.4,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                  >
                    {step.num}
                  </motion.div>
                  {/* Dashed line draws downward */}
                  {i < steps.length - 1 && (
                    <div
                      className="w-[2px] h-12 border-l-2 border-dashed border-gray-200 ml-0 origin-top"
                      style={{
                        transform: isInView ? 'scaleY(1)' : 'scaleY(0)',
                        transition: `transform 0.4s ease ${0.4 + i * 0.3}s`,
                      }}
                    />
                  )}
                </div>
                <motion.div
                  className="pb-8"
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.35 + i * 0.3, duration: 0.5 }}
                >
                  <h3 className="text-lg font-semibold text-gray-900 mt-1.5">{step.title}</h3>
                  <p className="text-base text-gray-500 mt-1 leading-relaxed">{step.desc}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Right — phone mockup (slides in from right with rotation) */}
          <motion.div
            className="mt-12 lg:mt-0 flex justify-center"
            initial={{ opacity: 0, x: 60, rotate: 3 }}
            animate={isInView ? { opacity: 1, x: 0, rotate: 0 } : {}}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="relative w-[280px] rounded-[2.5rem] border-[8px] border-gray-800 bg-gray-800 shadow-2xl shadow-black/30 overflow-hidden"
            >
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-gray-800 rounded-b-2xl z-10" />

              {/* Screen content */}
              <div className="relative bg-gradient-to-b from-white to-gray-50 rounded-[2rem] overflow-hidden aspect-[9/19.5]">
                {/* Status bar mockup */}
                <div className="h-12 bg-white flex items-end justify-between px-6 pb-1">
                  <span className="text-[10px] font-semibold text-gray-900">9:41</span>
                  <div className="flex gap-1 items-center">
                    <div className="w-3.5 h-2.5 border border-gray-400 rounded-sm relative">
                      <div className="absolute inset-[1px] right-[2px] bg-gray-400 rounded-[1px]" />
                    </div>
                  </div>
                </div>

                {/* App header */}
                <div className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-land-green-600 flex items-center justify-center text-[9px] font-bold text-white">A</div>
                    <span className="text-xs font-bold text-gray-900">AlphaSeekers</span>
                  </div>
                  <p className="text-[9px] text-gray-400">Welcome back 👋</p>
                </div>

                {/* Dashboard content */}
                <div className="px-5 py-4 space-y-3">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <p className="text-[8px] text-gray-400">Classes</p>
                      <p className="text-sm font-bold text-gray-900">3</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <p className="text-[8px] text-gray-400">Today</p>
                      <p className="text-sm font-bold text-land-green-600">2 sessions</p>
                    </div>
                  </div>

                  {/* Class cards */}
                  {['English A2', 'Graphic Design', 'Career Skills'].map((cls, j) => (
                    <div key={cls} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-semibold text-gray-900">{cls}</p>
                          <p className="text-[8px] text-gray-400 mt-0.5">{['Tue 6:00 PM', 'Wed 4:00 PM', 'Thu 5:30 PM'][j]}</p>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-land-green-50 flex items-center justify-center">
                          <svg className="w-3 h-3 text-land-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
