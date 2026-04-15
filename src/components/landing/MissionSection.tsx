'use client';

import { ScrollReveal } from './ScrollReveal';
import { useCountUp } from './CountUp';

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
  const hasRealData = studentCount > 0 || teacherCount > 0;

  return (
    <section className="w-full py-24 bg-land-green-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {hasRealData ? (
          /* === STATS MODE — Only shown when real data exists === */
          <ScrollReveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
              {studentCount > 0 && <StatCard value={studentCount} suffix="+" label="Students reached" />}
              {classCount > 0 && <StatCard value={classCount} suffix="" label="Live classes" />}
              {countryCount > 0 && <StatCard value={countryCount} suffix="+" label="Countries" />}
              {teacherCount > 0 && <StatCard value={teacherCount} suffix="+" label="Volunteer teachers" />}
            </div>
          </ScrollReveal>
        ) : (
          /* === MISSION MODE — Default when no real data === */
          <ScrollReveal>
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-land-green-400 text-sm font-semibold uppercase tracking-[0.15em] mb-4">
                Our Mission
              </p>
              <h2
                className="text-4xl lg:text-5xl font-bold text-white tracking-tight"
                style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}
              >
                Education is a right, not a privilege
              </h2>
              <p className="text-lg text-white/55 max-w-2xl mx-auto leading-relaxed mt-6">
                When Afghan students lost access to education, we built a classroom that fits in a pocket. Free forever. Open to every student who wants to learn.
              </p>

              {/* Feature pills */}
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                {[
                  '100% Free',
                  'Bilingual (Dari + English)',
                  '$0/month infrastructure',
                  'AI-powered study assistant',
                ].map((pill) => (
                  <span
                    key={pill}
                    className="bg-white/[0.06] border border-white/[0.08] text-white/70 text-sm font-medium px-5 py-2 rounded-full"
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
  );
}
