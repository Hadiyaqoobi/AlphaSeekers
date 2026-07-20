"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function TelegramLink() {
  const t = useTranslations("telegram");
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/telegram/link")
      .then((r) => r.json())
      .then((data) => setLinked(data.linked === true))
      .catch(() => setLinked(false))
      .finally(() => setLoading(false));
  }, []);

  async function handleLink() {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/telegram/link", { method: "POST" });
      const data = await response.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener");
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    setLoading(true);
    try {
      await fetch("/api/integrations/telegram/link", { method: "DELETE" });
      setLinked(false);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return null;
  }

  if (linked) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neon-200 bg-neon-50 px-3 py-2">
        <span className="text-sm font-semibold text-neon-700">{t("linked")}</span>
        <button
          className="ml-auto text-xs font-medium text-ink-soft hover:text-ink-main"
          onClick={handleUnlink}
          type="button"
        >
          {t("unlink")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-dark-100 p-3">
      <p className="text-sm font-semibold text-ink-main">{t("linkTitle")}</p>
      <p className="mt-1 text-xs text-ink-soft">{t("linkDescription")}</p>
      <button
        className="btn-secondary mt-2 text-xs"
        disabled={loading}
        onClick={handleLink}
        type="button"
      >
        {t("linkButton")}
      </button>
    </div>
  );
}
