// Plain <img> rather than next/image: Render free tier intermittently
// 504s on the image optimizer, leaving black placeholders
// (UAT 2026-04-26 HIGH-A).
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { teamMembers } from "@/lib/team-data";

type TeamPageProps = { params: { locale: string } };

export async function generateMetadata({ params }: TeamPageProps) {
  const t = await getTranslations({ locale: params.locale, namespace: "team" });
  return {
    title: `${t("kicker")} — AlphaSeekers`,
    description: t("subtitle"),
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "team" });
  const isDari = locale === "fa";

  const sorted = [...teamMembers].sort((a, b) => a.order - b.order);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-land-dark overflow-hidden">
        <div className="absolute blur-[120px] rounded-full opacity-20" style={{ width: 400, height: 400, top: '40%', left: '60%', background: 'radial-gradient(circle, rgba(29,185,100,0.12) 0%, transparent 70%)' }} aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-24 lg:py-32 text-center">
          <p className="text-land-green-400 text-sm font-semibold uppercase tracking-[0.15em] mb-4">{t("kicker")}</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t("title")}</h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto mt-6 leading-relaxed">{t("subtitle")}</p>
        </div>
      </section>

      {/* Team Grid — all members equal */}
      <section className="bg-[var(--bg-base)] py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 lg:gap-14">
            {sorted.map((member) => {
              const isCoFounder = member.role.includes("Co-Founder");
              return (
                <div key={member.id} className="group relative">
                  {/* Card */}
                  <div className="relative rounded-2xl overflow-hidden bg-dark-100 ring-1 ring-white/5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    {/* Photo */}
                    <div className="relative aspect-[4/5] overflow-hidden bg-dark-200">
                      {member.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.photo}
                          alt={isDari ? member.nameDari : member.name}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-land-green-600 to-land-green-800 flex items-center justify-center">
                          <span className="text-6xl font-bold text-white/30">{member.name.charAt(0)}</span>
                        </div>
                      )}
                      {/* Gradient overlay at bottom of photo */}
                      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
                      {/* Co-Founder badge */}
                      {isCoFounder && (
                        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-dark-100/95 backdrop-blur-sm text-land-green-400 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-land-green-500" />
                          Co-Founder
                        </span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-ink-main">{isDari ? member.nameDari : member.name}</h3>
                      <p className="text-sm font-semibold text-land-green-500 mt-1">{isDari ? member.roleDari : member.role}</p>
                      <p className="text-sm text-ink-soft mt-3 leading-relaxed">{isDari ? member.bioDari : member.bio}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-land-green-950 py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t("ctaTitle")}</h2>
          <p className="text-lg text-white/55 mt-4 max-w-xl mx-auto">{t("ctaBody")}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/${locale}/register`} className="inline-flex items-center px-8 py-4 rounded-xl bg-land-green-500 text-black text-base font-bold transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0">{t("ctaVolunteer")}</Link>
            <Link href={`/${locale}/register`} className="inline-flex items-center px-8 py-4 rounded-xl border-2 border-white/25 text-white text-base font-semibold transition-all duration-200 hover:bg-white/10 hover:-translate-y-1 active:translate-y-0">{t("ctaJoin")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
