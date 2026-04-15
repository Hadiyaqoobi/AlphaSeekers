'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const steps = [
  {
    icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
    title: 'Request access',
    desc: 'Sign up in 30 seconds',
  },
  {
    icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    title: 'Get approved',
    desc: 'Safe, vetted community',
  },
  {
    icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
    title: 'Browse classes',
    desc: 'Languages, arts, and skills',
  },
  {
    icon: 'M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59',
    title: 'Enroll',
    desc: 'One tap to join',
  },
  {
    icon: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z',
    title: 'Join live class',
    desc: 'Google Meet, one tap',
  },
];

// Sequential step animation: each step appears 0.5s after the previous
const stepDelay = (i: number) => 0.3 + i * 0.5;
const lineDelay = (i: number) => 0.3 + i * 0.5 + 0.15;

export function WorkflowPipeline() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="w-full py-24 bg-land-dark-100" id="workflow">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-land-green-400 text-sm font-semibold uppercase tracking-[0.15em] mb-4">
            The Student Journey
          </p>
          <h2
            className="text-3xl lg:text-4xl font-bold text-white tracking-tight mb-4"
            style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
          >
            From sign-up to your first live class
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            No fees. No complicated setup. Join a global classroom in minutes.
          </p>
        </div>

        {/* Pipeline */}
        <div ref={ref} className="relative">
          {/* Desktop: horizontal */}
          <div className="hidden lg:grid lg:grid-cols-5 lg:gap-0 relative">
            {/* Connecting lines — draw sequentially */}
            {[0, 1, 2, 3].map((i) => (
              <div
                key={`line-${i}`}
                className="absolute top-8 h-[2px] bg-land-green-500/30"
                style={{
                  left: `calc(${(i + 1) * 20}% - 10%)`,
                  width: 'calc(20%)',
                  transform: isInView ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: `transform 0.4s cubic-bezier(0.16,1,0.3,1) ${lineDelay(i)}s`,
                }}
              />
            ))}

            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className="flex flex-col items-center text-center relative z-10"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: stepDelay(i), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Icon with scale pulse + glow */}
                <motion.div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-500"
                  initial={{ scale: 0.8 }}
                  animate={isInView ? { scale: [0.8, 1.1, 1] } : {}}
                  transition={{
                    delay: stepDelay(i),
                    duration: 0.4,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  style={{
                    background: isInView ? 'rgba(29,185,100,0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isInView ? 'rgba(29,185,100,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isInView ? '0 0 20px rgba(29,185,100,0.15)' : 'none',
                    transitionDelay: `${stepDelay(i)}s`,
                  }}
                >
                  <svg className="w-7 h-7 text-land-green-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                  </svg>
                </motion.div>
                <p className="text-white text-sm font-semibold mt-4">{step.title}</p>
                <p className="text-white/40 text-xs mt-1 max-w-[140px]">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Mobile: vertical */}
          <div className="lg:hidden space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className="flex items-start gap-5"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex flex-col items-center">
                  <div
                    className="w-14 h-14 rounded-2xl bg-land-green-600/10 border border-land-green-500/30 flex items-center justify-center flex-shrink-0"
                    style={{ boxShadow: isInView ? '0 0 16px rgba(29,185,100,0.12)' : 'none' }}
                  >
                    <svg className="w-6 h-6 text-land-green-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                    </svg>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="w-[2px] h-8 bg-land-green-500/20 mt-2 origin-top"
                      style={{
                        transform: isInView ? 'scaleY(1)' : 'scaleY(0)',
                        transition: `transform 0.3s ease ${0.15 * i + 0.2}s`,
                      }}
                    />
                  )}
                </div>
                <div className="pt-3">
                  <p className="text-white text-sm font-semibold">{step.title}</p>
                  <p className="text-white/40 text-xs mt-1">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
