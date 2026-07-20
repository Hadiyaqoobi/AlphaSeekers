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
    // A stale-chunk / deployment-skew error means our build changed under an
    // open page. Reload once to pick up the fresh build rather than showing
    // a dead error panel.
    const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
    if (/ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(msg)) {
      try {
        if (!sessionStorage.getItem("as:chunk-reloaded")) {
          sessionStorage.setItem("as:chunk-reloaded", "1");
          window.location.reload();
          return;
        }
      } catch {
        /* ignore */
      }
    }
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
