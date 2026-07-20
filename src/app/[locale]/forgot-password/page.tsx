"use client";

import { useState } from "react";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";

const SOFT = "#93A9BC";
const GREEN = "#00E676";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const tl = useTranslations("login");
  const params = useParams<{ locale: string }>();
  const locale = params.locale || "fa";

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
    } catch {
      // Uniform UX — always show the "check your email" state.
    }
    setSubmitting(false);
    setSent(true);
  }

  return (
    <div className="auth-page flex min-h-screen items-center justify-center px-6 py-12" style={{ background: "#070B0E" }}>
      <div className="w-full max-w-[404px] animate-fade-in-up">
        <div className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/wordmark-192.png" alt="AlphaSeekers" width={84} height={66} />
        </div>

        {sent ? (
          <div className="text-center">
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(0,230,118,0.10)", border: "1px solid rgba(0,230,118,0.2)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.7">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path strokeLinecap="round" d="M4 7l8 5 8-5" />
              </svg>
            </div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-white">{t("sentTitle")}</h1>
            <p className="mt-3 text-sm" style={{ color: SOFT }}>
              {t("sentBody")}
            </p>
            <Link href={`/${locale}/login`} className="mt-6 inline-block text-sm font-bold" style={{ color: GREEN }}>
              {t("backToLogin")}
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
                  {tl("email")}
                </label>
                <div className="auth-field">
                  <span className="auth-lic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" />
                      <path strokeLinecap="round" d="M4 7l8 5 8-5" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={tl("emailPlaceholder")}
                  />
                </div>
              </div>

              <button type="submit" disabled={submitting} className="auth-primary mt-1">
                <span>{submitting ? t("sending") : t("submit")}</span>
              </button>
            </form>

            <p className="mt-6 text-center text-sm" style={{ color: SOFT }}>
              <Link href={`/${locale}/login`} className="font-bold" style={{ color: GREEN }}>
                {t("backToLogin")}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
