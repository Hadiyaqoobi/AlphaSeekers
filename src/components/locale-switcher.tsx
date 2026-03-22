"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/i18n";

type LocaleSwitcherProps = {
  currentLocale: Locale;
};

export function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const nextLocale: Locale = currentLocale === "fa" ? "en" : "fa";

  const segments = pathname.split("/");
  segments[1] = nextLocale;
  const nextPath = segments.join("/") || `/${nextLocale}`;

  return (
    <Link
      aria-label={`Switch language to ${nextLocale === "fa" ? "Farsi" : "English"}`}
      className="btn-primary"
      href={nextPath}
    >
      {nextLocale.toUpperCase()}
    </Link>
  );
}
