"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

type GoogleStatusPayload = {
  connected: boolean;
  accountEmail: string | null;
  connectedAt: string | null;
};

type GoogleConnectCardProps = {
  locale: string;
  notice?: "connected" | "failed";
};

export function GoogleConnectCard({ locale, notice }: GoogleConnectCardProps) {
  const t = useTranslations("google");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GoogleStatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/integrations/google/status", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load Google connection status");
        }

        const payload = (await response.json()) as GoogleStatusPayload;

        if (!cancelled) {
          setStatus(payload);
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <article className="panel panel-strong p-4">
      <h3 className="text-sm font-black text-ink-main">{t("title")}</h3>

      {notice === "connected" ? (
        <p className="mt-2 text-xs text-neon-700">{t("noticeConnected")}</p>
      ) : null}

      {notice === "failed" ? (
        <p className="mt-2 text-xs text-rose-700">{t("noticeFailed")}</p>
      ) : null}

      {loading ? <p className="mt-2 text-xs text-ink-soft">{t("checking")}</p> : null}

      {!loading && status?.connected ? (
        <p className="mt-2 text-xs text-ink-main">
          {status.connectedAt
            ? t("connectedAsOn", {
                email: status.accountEmail ?? t("accountFallback"),
                time: new Date(status.connectedAt).toLocaleString(),
              })
            : t("connectedAs", { email: status.accountEmail ?? t("accountFallback") })}
        </p>
      ) : null}

      {!loading && !status?.connected ? (
        <p className="mt-2 text-xs text-ink-main">
          {t("notConnected")}
        </p>
      ) : null}

      <a
        className="btn-secondary mt-3"
        href={`/api/integrations/google/connect?locale=${locale}`}
      >
        {status?.connected ? t("reconnect") : t("connect")}
      </a>
    </article>
  );
}
