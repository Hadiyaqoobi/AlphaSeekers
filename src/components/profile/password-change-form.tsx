"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function PasswordChangeForm() {
  const t = useTranslations("profile.password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "ok" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setStatus({ kind: "error", message: t("errors.tooShort") });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: t("errors.mismatch") });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const r = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        const codeMap: Record<string, string> = {
          wrong_current: t("errors.wrongCurrent"),
          same_as_current: t("errors.sameAsCurrent"),
          too_short: t("errors.tooShort"),
        };
        const translated = body?.code && codeMap[body.code as string];
        setStatus({
          kind: "error",
          message: translated ?? body?.message ?? t("errors.generic"),
        });
        return;
      }
      setStatus({ kind: "ok" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setStatus({ kind: "error", message: t("errors.network") });
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-dark-100 p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink-main">{t("title")}</h2>
          <p className="text-xs text-ink-soft">{t("subtitle")}</p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-soft" htmlFor="currentPassword">
            {t("current")}
          </label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-dark-50 px-3 py-2.5 text-sm text-ink-main outline-none transition focus:border-neon-500 focus:ring-2 focus:ring-neon-500/20"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft" htmlFor="newPassword">
              {t("new")}
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              maxLength={72}
              className="w-full rounded-lg border border-line bg-dark-50 px-3 py-2.5 text-sm text-ink-main outline-none transition focus:border-neon-500 focus:ring-2 focus:ring-neon-500/20"
            />
            <p className="mt-1 text-[11px] text-ink-faint">{t("hint")}</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft" htmlFor="confirmPassword">
              {t("confirm")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-line bg-dark-50 px-3 py-2.5 text-sm text-ink-main outline-none transition focus:border-neon-500 focus:ring-2 focus:ring-neon-500/20"
            />
          </div>
        </div>

        {status.kind === "error" ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {status.message}
          </div>
        ) : null}

        {status.kind === "ok" ? (
          <div
            role="status"
            className="rounded-lg border border-neon-500/30 bg-neon-500/10 px-3 py-2 text-sm text-neon-300"
          >
            {t("success")}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={status.kind === "submitting"}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          {status.kind === "submitting" ? t("submitting") : t("submit")}
        </button>
      </form>
    </div>
  );
}
