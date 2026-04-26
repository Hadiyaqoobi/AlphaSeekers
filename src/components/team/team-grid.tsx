'use client';

import type { TeamMember } from '@/lib/team-data';

type TeamGridProps = {
  members: TeamMember[];
  locale: string;
  gridTitle: string;
};

export function TeamGrid({ members, locale, gridTitle }: TeamGridProps) {
  const isDari = locale === 'fa';

  return (
    <section className="bg-[var(--bg-base)] py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-[var(--ink-main)] text-center mb-12">{gridTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {members.map((member, i) => (
            <div key={member.id} className="group" style={{ animationDelay: `${i * 0.1}s` }}>
              {/* Photo — plain <img> rather than next/image: Render free tier
                  intermittently 504s on the image optimizer, leaving black
                  placeholders (UAT 2026-04-26 HIGH-A). */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--bg-strong)]">
                {member.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.photo}
                    alt={isDari ? member.nameDari : member.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-land-green-600 to-land-green-800 flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.03]">
                    <span className="text-5xl font-bold text-white/40">{member.name.charAt(0)}</span>
                  </div>
                )}
              </div>
              {/* Info */}
              <h3 className="text-lg font-semibold text-[var(--ink-main)] mt-4">{isDari ? member.nameDari : member.name}</h3>
              <p className="text-sm font-medium text-land-green-500 mt-0.5">{isDari ? member.roleDari : member.role}</p>
              <p className="text-sm text-[var(--ink-soft)] mt-3 leading-relaxed line-clamp-3">{isDari ? member.bioDari : member.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
