"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { reportError } from "@/lib/observability/report";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    void reportError(error, { digest: error.digest, boundary: "locale" });
  }, [error]);

  return (
    <section className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="panel panel-strong mx-auto max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-2xl font-black text-ink-main">{t("title")}</h1>
        <p className="text-sm text-ink-soft">{t("body")}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button className="btn-primary" onClick={() => reset()} type="button">
            {t("retry")}
          </button>
          <a className="btn-secondary" href="/">
            {t("goHome")}
          </a>
        </div>
      </div>
    </section>
  );
}
