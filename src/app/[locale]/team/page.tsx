import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { teamMembers } from "@/lib/team-data";
import { TeamGrid } from "@/components/team/team-grid";

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

  const ceo = teamMembers.find((m) => m.id === "sahar")!;
  const others = teamMembers.filter((m) => m.id !== "sahar").sort((a, b) => a.order - b.order);

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

      {/* CEO Spotlight */}
      <section className="bg-[var(--bg-base)] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
            {/* Photo */}
            <div className="relative aspect-[3/4] lg:aspect-[4/5] rounded-2xl overflow-hidden shadow-xl">
              {ceo.photo ? (
                <Image src={ceo.photo} alt={isDari ? ceo.nameDari : ceo.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" priority />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-land-green-600 to-land-green-800 flex items-center justify-center">
                  <span className="text-6xl font-bold text-white/30">{ceo.name.charAt(0)}</span>
                </div>
              )}
            </div>
            {/* Info */}
            <div className="mt-10 lg:mt-0">
              <span className="inline-flex bg-land-green-50 text-land-green-700 text-sm font-medium px-4 py-1.5 rounded-full">{t("spotlightBadge")}</span>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-4 tracking-tight">{isDari ? ceo.nameDari : ceo.name}</h2>
              <p className="text-base text-gray-500 mt-4 leading-relaxed">{isDari ? ceo.bioDari : ceo.bio}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Grid */}
      <TeamGrid members={others} locale={locale} gridTitle={t("teamGridTitle")} />

      {/* CTA */}
      <section className="bg-land-green-950 py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-landing), var(--font-display-latin), sans-serif' }}>{t("ctaTitle")}</h2>
          <p className="text-lg text-white/55 mt-4 max-w-xl mx-auto">{t("ctaBody")}</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/${locale}/register`} className="inline-flex items-center px-8 py-4 rounded-xl bg-white text-land-green-700 text-base font-bold transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0">{t("ctaVolunteer")}</Link>
            <Link href={`/${locale}/register`} className="inline-flex items-center px-8 py-4 rounded-xl border-2 border-white/25 text-white text-base font-semibold transition-all duration-200 hover:bg-white/10 hover:-translate-y-1 active:translate-y-0">{t("ctaJoin")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
