"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type InitialState = {
  code: string | null;
  expiresAt: string | null;
};

interface CheckinCodePanelProps {
  classId: string;
  sessionId: string;
  initial?: InitialState;
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CheckinCodePanel({ classId, sessionId, initial }: CheckinCodePanelProps) {
  const t = useTranslations("checkin");
  const [code, setCode] = useState<string | null>(initial?.code ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(initial?.expiresAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string>(() =>
    initial?.expiresAt ? formatRemaining(initial.expiresAt) : "",
  );

  // Tick countdown once per second
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = new Date(expiresAt).getTime() - Date.now();
      setRemaining(formatRemaining(expiresAt));
      if (left <= 0) {
        setCode(null);
        setExpiresAt(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/classes/${classId}/sessions/${sessionId}/checkin-code`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t("generateFailed"));
        return;
      }
      setCode(data.code);
      setExpiresAt(data.expiresAt);
    } catch {
      setError(t("generateFailed"));
    } finally {
      setLoading(false);
    }
  }, [classId, sessionId, t]);

  if (!code) {
    return (
      <div className="rounded-2xl border border-line bg-dark-100 p-6">
        <h3 className="text-sm font-semibold text-ink-main mb-1">{t("title")}</h3>
        <p className="text-xs text-ink-soft mb-4">{t("teacherHint")}</p>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-neon-600 text-white hover:bg-neon-700 disabled:opacity-50"
        >
          {loading ? t("generating") : t("generateCode")}
        </button>
        {error ? <p className="text-xs text-red-400 mt-3">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neon-500/30 bg-dark-100 p-6 text-center">
      <p className="text-xs text-ink-soft mb-2">{t("shareCode")}</p>
      <div className="text-5xl font-bold text-neon-400 tracking-[0.3em] my-4 font-mono">
        {code}
      </div>
      <p className="text-xs text-ink-faint">
        {remaining && remaining !== "0:00"
          ? t("expiresInTimer", { time: remaining })
          : t("expiresIn")}
      </p>
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="mt-4 px-3 py-1.5 rounded-lg text-xs text-ink-soft border border-line hover:text-ink-main disabled:opacity-50"
      >
        {loading ? t("generating") : t("generateNew")}
      </button>
      {error ? <p className="text-xs text-red-400 mt-3">{error}</p> : null}
    </div>
  );
}
