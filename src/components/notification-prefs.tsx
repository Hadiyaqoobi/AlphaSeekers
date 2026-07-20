"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";

type Prefs = {
  telegram: boolean;
  webPush: boolean;
  email: boolean;
};

const DEFAULT_PREFS: Prefs = { telegram: true, webPush: true, email: true };

export function NotificationPrefs() {
  const t = useTranslations("notificationPrefs");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me/notification-prefs")
      .then((res) => res.json())
      .then((data: Prefs) => setPrefs(data))
      .catch(() => {
        // Use defaults
      });
  }, []);

  const toggle = useCallback(async (channel: keyof Prefs) => {
    const updated = { ...prefs, [channel]: !prefs[channel] };
    setPrefs(updated);
    setSaving(true);
    try {
      await fetch("/api/me/notification-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      // Revert on error
      setPrefs(prefs);
    }
    setSaving(false);
  }, [prefs]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-main">{t("title")}</h3>
      <p className="text-xs text-ink-soft">{t("description")}</p>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-main">
          <input
            checked={prefs.telegram}
            className="h-4 w-4 rounded border-line text-neon-600 focus:ring-neon-500"
            disabled={saving}
            onChange={() => toggle("telegram")}
            type="checkbox"
          />
          {t("telegram")}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-main">
          <input
            checked={prefs.webPush}
            className="h-4 w-4 rounded border-line text-neon-600 focus:ring-neon-500"
            disabled={saving}
            onChange={() => toggle("webPush")}
            type="checkbox"
          />
          {t("webPush")}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-main">
          <input
            checked={prefs.email}
            className="h-4 w-4 rounded border-line text-neon-600 focus:ring-neon-500"
            disabled={saving}
            onChange={() => toggle("email")}
            type="checkbox"
          />
          {t("email")}
        </label>
      </div>
    </div>
  );
}
