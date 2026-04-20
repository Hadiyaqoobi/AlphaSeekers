'use client';

import Image from 'next/image';
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
              {/* Photo */}
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--bg-strong)]">
                {member.photo ? (
                  <Image
                    src={member.photo}
                    alt={isDari ? member.nameDari : member.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
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
