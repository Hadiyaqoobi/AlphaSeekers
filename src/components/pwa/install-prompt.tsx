"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already dismissed
    if (localStorage.getItem("pwa-install-dismissed")) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-pulse-once">
      <div className="panel panel-strong flex items-center gap-3 p-3 shadow-lg">
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">{t("installTitle")}</p>
          <p className="text-xs text-slate-600">{t("installBody")}</p>
        </div>
        <button className="btn-primary text-xs" onClick={handleInstall} type="button">
          {t("install")}
        </button>
        <button
          aria-label={t("dismiss")}
          className="text-slate-400 hover:text-slate-600"
          onClick={handleDismiss}
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
