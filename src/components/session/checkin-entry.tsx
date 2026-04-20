"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

interface CheckinEntryProps {
  classId: string;
  sessionId: string;
  initiallyVerified?: boolean;
  initialVerifiedAt?: string | null;
}

export function CheckinEntry({
  classId,
  sessionId,
  initiallyVerified,
  initialVerifiedAt,
}: CheckinEntryProps) {
  const t = useTranslations("checkin");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    initiallyVerified ? "success" : "idle",
  );
  const [message, setMessage] = useState<string>("");
  const [verifiedAt, setVerifiedAt] = useState<string | null>(
    initialVerifiedAt ?? null,
  );

  async function submitCode() {
    if (code.length !== 4) return;
    setStatus("loading");

    try {
      const res = await fetch(
        `/api/classes/${classId}/sessions/${sessionId}/checkin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        },
      );
      const data = await res.json();

      if (data.success) {
        setStatus("success");
        setVerifiedAt(new Date().toISOString());
        return;
      }

      const codeMap: Record<string, string> = {
        invalid_format: t("invalidFormat"),
        no_code_yet: t("noCodeYet"),
        expired: t("expiredCode"),
        wrong: t("incorrectCode"),
        rate_limited: t("rateLimited"),
      };
      const translated = data.code && codeMap[data.code as string];
      setStatus("error");
      setMessage(translated ?? data.message ?? t("incorrectCode"));
    } catch {
      setStatus("error");
      setMessage(t("networkError"));
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-neon-500/30 bg-neon-500/10 p-4 text-center">
        <div className="text-2xl mb-2">✓</div>
        <p className="text-sm font-semibold text-neon-400">{t("verified")}</p>
        <p className="text-xs text-ink-soft mt-1">
          {t("markedPresent")}
          {verifiedAt
            ? ` — ${new Date(verifiedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-DEFAULT bg-dark-100 p-5">
      <h4 className="text-sm font-semibold text-ink-main mb-1">{t("title")}</h4>
      <p className="text-xs text-ink-soft mb-4">{t("enterCode")}</p>

      <div className="flex gap-3 items-center">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={code}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 4);
            setCode(val);
            if (status === "error") setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length === 4 && status !== "loading") {
              submitCode();
            }
          }}
          placeholder="_ _ _ _"
          aria-label={t("title")}
          className="flex-1 text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 bg-dark-50 border border-line-DEFAULT rounded-xl text-ink-main placeholder:text-ink-faint placeholder:tracking-[0.3em] focus:border-neon-500 focus:outline-none focus:ring-2 focus:ring-neon-500/20"
        />
        <button
          type="button"
          onClick={submitCode}
          disabled={code.length !== 4 || status === "loading"}
          className="px-5 py-3 rounded-xl text-sm font-semibold bg-neon-600 text-white hover:bg-neon-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "..." : t("verify")}
        </button>
      </div>

      {status === "error" ? (
        <p className="text-xs text-red-400 mt-3">{message}</p>
      ) : null}
    </div>
  );
}
