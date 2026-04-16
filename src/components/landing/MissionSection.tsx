'use client';

import { ScrollReveal } from './ScrollReveal';
import { useCountUp } from './CountUp';
import { useTranslations } from 'next-intl';

type MissionSectionProps = {
  /** Pass real counts from the database. If 0 or missing, mission mode is shown. */
  studentCount?: number;
  teacherCount?: number;
  countryCount?: number;
  classCount?: number;
};

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, count } = useCountUp(value);
  return (
    <div className="text-center" ref={ref}>
      <p
        className="text-5xl lg:text-6xl font-extrabold text-white tracking-tight"
        style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
      >
        {count}{suffix}
      </p>
      <p className="text-sm text-white/50 mt-2 font-medium">{label}</p>
    </div>
  );
}

export function MissionSection({ studentCount = 0, teacherCount = 0, countryCount = 0, classCount = 0 }: MissionSectionProps) {
  const t = useTranslations('landing');
  const hasRealData = studentCount > 0 || teacherCount > 0;

  return (
    <>
      {/* Smooth gradient transition INTO the mission section */}
      <div className="h-32 bg-gradient-to-b from-dark-DEFAULT to-[#0A2818] pointer-events-none" aria-hidden="true" />

      <section className="relative w-full py-24 bg-[#0A2818] overflow-hidden">
        {/* Atmospheric green glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(0,230,118,0.18)_0%,transparent_60%)] pointer-events-none" aria-hidden="true" />
        {/* Cyan accent on the right */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(0,229,255,0.08)_0%,transparent_50%)] pointer-events-none" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          {hasRealData ? (
            <ScrollReveal>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
                {studentCount > 0 && <StatCard value={studentCount} suffix="+" label="Students reached" />}
                {classCount > 0 && <StatCard value={classCount} suffix="" label="Live classes" />}
                {countryCount > 0 && <StatCard value={countryCount} suffix="+" label="Countries" />}
                {teacherCount > 0 && <StatCard value={teacherCount} suffix="+" label="Volunteer teachers" />}
              </div>
            </ScrollReveal>
          ) : (
            <ScrollReveal>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-sm uppercase tracking-[0.15em] text-neon-400 font-medium mb-4">
                  {t('mission.kicker')}
                </p>
                <h2
                  className="text-4xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]"
                  style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
                >
                  {t('mission.title')}
                </h2>
                <p className="text-lg text-white/55 max-w-2xl mx-auto leading-relaxed mt-6">
                  {t('mission.body')}
                </p>

                {/* Feature pills */}
                <div className="mt-10 flex flex-wrap justify-center gap-3">
                  {[
                    t('mission.pills.0'),
                    t('mission.pills.1'),
                    t('mission.pills.2'),
                    t('mission.pills.3'),
                  ].map((pill) => (
                    <span
                      key={pill}
                      className="bg-white/[0.04] border border-white/[0.08] text-white/75 text-sm font-medium px-5 py-2 rounded-full backdrop-blur-sm hover:border-neon-500/30 hover:bg-neon-500/[0.05] transition-colors"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* Smooth gradient transition OUT of the mission section */}
      <div className="h-32 bg-gradient-to-b from-[#0A2818] to-dark-DEFAULT pointer-events-none" aria-hidden="true" />
    </>
  );
}
