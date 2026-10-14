"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type WebinarRegisterButtonProps = {
  webinarId: string;
};

export function WebinarRegisterButton({ webinarId }: WebinarRegisterButtonProps) {
  const router = useRouter();
  const t = useTranslations("webinars");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function register() {
    if (registered) return;
    setLoading(true);
    setStatus(null);

    const response = await fetch(`/api/webinars/${webinarId}/register`, {
      method: "POST",
    });

    if (!response.ok) {
      // Translated fallback; the server's English `message` is not shown.
      setStatus(t("registrationFailed"));
      setLoading(false);
      return;
    }

    setRegistered(true);
    setStatus(t("registeredStatus"));
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        className={registered ? "btn-muted" : "btn-primary"}
        disabled={loading || registered}
        onClick={register}
        type="button"
      >
        {loading ? "..." : registered ? t("registeredBadge") : t("registerButton")}
      </button>
      {status && !registered ? <p className="text-xs text-ink-soft">{status}</p> : null}
    </div>
  );
}
