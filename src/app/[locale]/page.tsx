import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AnimatedStat } from "@/components/public/animated-stat";
import { FaqAccordion } from "@/components/public/faq-accordion";
import { HeroSection } from "@/components/public/hero-section";
import { getSessionUser } from "@/lib/security/session";

type HomePageProps = {
  params: { locale: string };
};

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className ?? "h-5 w-5"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  );
}

function gatedHref(locale: string, signedIn: boolean, target: string) {
  if (signedIn) return target;
  return `/${locale}/login?next=${encodeURIComponent(target)}`;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "home" });
  const navT = await getTranslations({ locale, namespace: "nav" });
  const user = await getSessionUser();
  const signedIn = Boolean(user);

  const primaryCtaHref = signedIn ? `/${locale}/dashboard` : `/${locale}/register`;

  const programs = [
    {
      title: navT("classes"),
      kicker: t("programs.cards.classes.kicker"),
      body: t("programs.cards.classes.body"),
      href: gatedHref(locale, signedIn, `/${locale}/classes`),
      icon: "M4 5h16v14H4V5zm4 0v14",
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      title: navT("library"),
      kicker: t("programs.cards.library.kicker"),
      body: t("programs.cards.library.body"),
      href: gatedHref(locale, signedIn, `/${locale}/library`),
      icon: "M4 19a2 2 0 002 2h12V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14zm4-14h8",
      color: "bg-teal-50 text-teal-700",
    },
    {
      title: navT("webinars"),
      kicker: t("programs.cards.webinars.kicker"),
      body: t("programs.cards.webinars.body"),
      href: gatedHref(locale, signedIn, `/${locale}/webinars`),
      icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z",
      color: "bg-sky-50 text-sky-700",
    },
    {
      title: navT("opportunities"),
      kicker: t("programs.cards.opportunities.kicker"),
      body: t("programs.cards.opportunities.body"),
      href: gatedHref(locale, signedIn, `/${locale}/opportunities`),
      icon: "M12 8V4m0 4a4 4 0 00-4 4v8h8v-8a4 4 0 00-4-4zm-6 2h12",
      color: "bg-amber-50 text-amber-700",
    },
  ];

  const faqItems = [
    { id: "access", question: t("faq.items.access.q"), answer: t("faq.items.access.a") },
    { id: "privacy", question: t("faq.items.privacy.q"), answer: t("faq.items.privacy.a") },
    { id: "cost", question: t("faq.items.cost.q"), answer: t("faq.items.cost.a") },
    { id: "languages", question: t("faq.items.languages.q"), answer: t("faq.items.languages.a") },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 space-y-14 sm:space-y-20 pb-16">
      <HeroSection signedIn={signedIn} />

      {/* Stats */}
      <section className="stats-grid grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4" id="trust">
        <article className="bg-white p-6">
          <p className="text-sm font-medium text-slate-500">{t("stats.studentsLabel")}</p>
          <div className="mt-1 text-3xl font-bold text-emerald-700">
            <AnimatedStat suffix="+" value={500} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{t("stats.studentsHint")}</p>
        </article>
        <article className="bg-white p-6">
          <p className="text-sm font-medium text-slate-500">{t("stats.liveClassesLabel")}</p>
          <div className="mt-1 text-3xl font-bold text-emerald-700">
            <AnimatedStat value={28} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{t("stats.liveClassesHint")}</p>
        </article>
        <article className="bg-white p-6">
          <p className="text-sm font-medium text-slate-500">{t("stats.programsLabel")}</p>
          <div className="mt-1 text-3xl font-bold text-emerald-700">
            <AnimatedStat value={4} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{t("stats.programsHint")}</p>
        </article>
        <article className="bg-white p-6">
          <p className="text-sm font-medium text-slate-500">{t("stats.designGoalLabel")}</p>
          <div className="mt-1 text-3xl font-bold text-emerald-700">{t("stats.designGoalValue")}</div>
          <p className="mt-1 text-sm text-slate-500">{t("stats.designGoalHint")}</p>
        </article>
      </section>

      {/* Programs */}
      <section id="programs">
        <div className="mb-8">
          <div className="accent-bar mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t("programs.title")}</h2>
          <p className="mt-2 text-slate-600">{t("programs.subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((program) => (
            <Link
              key={program.title}
              className="card-interactive group flex flex-col gap-4 p-6"
              href={program.href}
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${program.color}`}>
                  <Icon className="h-5 w-5" path={program.icon} />
                </div>
                <span className="text-xs font-medium text-slate-400">{program.kicker}</span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900">{program.title}</h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{program.body}</p>
              </div>

              <span className="text-sm font-medium text-emerald-700 group-hover:underline underline-offset-2">
                {t("programs.view")} &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="section-dark rounded-xl p-8 sm:p-12" id="how-it-works">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{t("how.title")}</h2>
          <p className="mt-2 text-slate-400">{t("how.subtitle")}</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <article>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-900/20">1</div>
            <h3 className="font-semibold text-white">{t("how.steps.one.title")}</h3>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">{t("how.steps.one.body")}</p>
          </article>
          <article>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-900/20">2</div>
            <h3 className="font-semibold text-white">{t("how.steps.two.title")}</h3>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">{t("how.steps.two.body")}</p>
          </article>
          <article>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-900/20">3</div>
            <h3 className="font-semibold text-white">{t("how.steps.three.title")}</h3>
            <p className="mt-1 text-sm text-slate-400 leading-relaxed">{t("how.steps.three.body")}</p>
          </article>
        </div>

        <div className="mt-10">
          <Link className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md" href={primaryCtaHref}>
            {signedIn ? t("how.ctaSignedIn") : t("how.cta")}
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="mb-8">
          <div className="accent-bar mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t("faq.title")}</h2>
          <p className="mt-2 text-slate-600">{t("faq.subtitle")}</p>
        </div>

        <div className="max-w-2xl">
          <FaqAccordion items={faqItems} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-8 pb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white">A</span>
          <span className="text-sm font-semibold text-slate-700">AlphaSeekers</span>
        </div>
        <p className="text-sm text-slate-500">{t("footer")}</p>
      </footer>
    </section>
  );
}
