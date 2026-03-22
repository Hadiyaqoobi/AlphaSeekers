"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type QuickTag = {
  label: string;
  query: string;
};

type LandingSearchProps = {
  locale: string;
  signedIn: boolean;
};

export function LandingSearch({ locale, signedIn }: LandingSearchProps) {
  const t = useTranslations("home");
  const router = useRouter();
  const [query, setQuery] = useState("");

  const quickTags = useMemo<QuickTag[]>(
    () => [
      { label: t("search.quick.languages"), query: "Languages" },
      { label: t("search.quick.skills"), query: "Professional Skills" },
      { label: t("search.quick.arts"), query: "Arts" },
      { label: t("search.quick.english"), query: "English" },
    ],
    [t],
  );

  function buildTarget(nextQuery: string) {
    const trimmed = nextQuery.trim();
    const target = trimmed.length > 0 ? `/${locale}/classes?search=${encodeURIComponent(trimmed)}` : `/${locale}/classes`;
    return signedIn ? target : `/${locale}/login?next=${encodeURIComponent(target)}`;
  }

  function submit(nextQuery: string) {
    router.push(buildTarget(nextQuery));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit(query);
  }

  return (
    <section className="panel panel-strong p-4 sm:p-5">
      <p className="section-kicker">{t("search.kicker")}</p>
      <h2 className="mt-2 text-lg font-black text-slate-950">{t("search.title")}</h2>

      <form className="mt-4 flex flex-wrap gap-2" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="landing-search">
          {t("search.label")}
        </label>
        <input
          className="field min-w-[220px] flex-1"
          id="landing-search"
          inputMode="search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.placeholder")}
          value={query}
        />
        <button className="btn-primary" type="submit">
          {t("search.button")}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickTags.map((tag) => (
          <button
            className="badge-pill hover:brightness-95"
            key={tag.query}
            onClick={() => submit(tag.query)}
            type="button"
          >
            {tag.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs font-semibold text-slate-600">{t("search.helper")}</p>
    </section>
  );
}

