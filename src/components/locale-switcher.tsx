"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { Locale } from "@/lib/i18n";

type LocaleSwitcherProps = {
  currentLocale: Locale;
};

export function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const nextLocale: Locale = currentLocale === "fa" ? "en" : "fa";

  const segments = pathname.split("/");
  segments[1] = nextLocale;
  const nextPath = segments.join("/") || `/${nextLocale}`;

  return (
    <Link
      aria-label={`Switch language to ${nextLocale === "fa" ? "Dari" : "English"}`}
      className="btn-primary"
      href={nextPath}
      onClick={(event) => {
        // Keep ?page=, ?search= etc. when switching language. Read at click
        // time (not via useSearchParams, which would force a Suspense boundary
        // around every page that renders this layout).
        const query = window.location.search;
        if (!query || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        router.push(`${nextPath}${query}${window.location.hash}`);
      }}
    >
      {nextLocale === "fa" ? "دری" : "EN"}
    </Link>
  );
}
