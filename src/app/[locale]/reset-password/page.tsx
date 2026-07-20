"use client";

import { useState } from "react";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const SOFT = "#93A9BC";
const GREEN = "#00E676";

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = params.locale || "fa";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError(t("weak"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      setSubmitting(false);
      if (res.ok) {
        setDone(true);
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.code === "invalid_token" ? t("invalidToken") : data?.message ?? t("weak"));
    } catch {
      setSubmitting(false);
      setError(t("weak"));
    }
  }

  return (
    <div className="auth-page flex min-h-screen items-center justify-center px-6 py-12" style={{ background: "#070B0E" }}>
      <div className="w-full max-w-[404px] animate-fade-in-up">
        <div className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/wordmark-192.png" alt="AlphaSeekers" width={84} height={66} />
        </div>

        {done ? (
          <div className="text-center">
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(0,230,118,0.10)", border: "1px solid rgba(0,230,118,0.2)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-white">{t("successTitle")}</h1>
            <p className="mt-3 text-sm" style={{ color: SOFT }}>
              {t("successBody")}
            </p>
            <Link href={`/${locale}/login`} className="auth-primary mt-6" role="button">
              <span>{t("goToLogin")}</span>
            </Link>
          </div>
        ) : !token ? (
          <div className="text-center">
            <h1 className="text-[26px] font-extrabold tracking-tight text-white">{t("title")}</h1>
            <p className="mt-3 text-sm" style={{ color: "#F87171" }}>
              {t("invalidToken")}
            </p>
            <Link href={`/${locale}/forgot-password`} className="mt-6 inline-block text-sm font-bold" style={{ color: GREEN }}>
              {t("requestNew")}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-[28px] font-extrabold tracking-tight text-white">{t("title")}</h1>
            <p className="mt-2.5 text-sm" style={{ color: SOFT }}>
              {t("subtitle")}
            </p>

            <form className="mt-7 flex flex-col gap-[18px]" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: SOFT }}>
                  {t("newPassword")}
                </label>
                <div className="auth-field">
                  <span className="auth-lic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4" y="10" width="16" height="10" rx="2.5" />
                      <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    tabIndex={-1}
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: SOFT }}>
                  {t("confirmPassword")}
                </label>
                <div className="auth-field">
                  <span className="auth-lic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4" y="10" width="16" height="10" rx="2.5" />
                      <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2 rounded-xl p-3 text-sm"
                  style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}
                >
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={submitting} className="auth-primary mt-1">
                <span>{submitting ? t("resetting") : t("submit")}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
