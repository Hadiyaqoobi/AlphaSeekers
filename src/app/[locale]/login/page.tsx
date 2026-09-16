"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";

const SOFT = "#93A9BC";
const FAINT = "#5F7C93";
const GREEN = "#00E676";

/**
 * Every way a sign-in can be refused, mapped to something the student can act
 * on. Previously all of these rendered as one generic "wrong email or
 * password", so a rate-limited student retried carefully, failed again, and
 * concluded their account was broken.
 */
function messageForError(
  code: string | null | undefined,
  t: (key: string) => string,
): string | null {
  if (!code) return null;
  switch (code) {
    case "PENDING_APPROVAL":
      return t("pending");
    case "TOO_MANY_ATTEMPTS":
      return t("tooManyAttempts");
    case "ACCOUNT_DEACTIVATED":
      return t("deactivated");
    case "EMAIL_UNVERIFIED":
      return t("googleEmailUnverified");
    case "NO_EMAIL":
      return t("googleNoEmail");
    case "SIGNIN_FAILED":
      return t("googleFailed");
    default:
      return t("error");
  }
}

export default function LoginPage() {
  const t = useTranslations("login");
  const b = useTranslations("register"); // shared brand-panel strings (already translated in both locales)
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const locale = params.locale || "fa";
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && (nextParam === `/${locale}` || nextParam.startsWith(`/${locale}/`))
      ? nextParam
      : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    // `googleError` is set by the signIn callback's redirect; `error` is
    // NextAuth's own parameter.
    messageForError(searchParams.get("googleError") ?? searchParams.get("error"), t),
  );

  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Ask NextAuth what is actually configured rather than reading an env var.
  // The provider is only registered when GOOGLE_CLIENT_ID/SECRET are present,
  // so this keeps the button and the server in step with no extra env to set,
  // and no broken button in environments without Google credentials.
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getProviders()
      .then((providers) => {
        if (!cancelled) setGoogleEnabled(Boolean(providers?.google));
      })
      .catch(() => {
        // Never let a failed probe hide the password form.
        if (!cancelled) setGoogleEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);

    if (!result || !result.ok) {
      setErrorMessage(messageForError(result?.error, t) ?? t("error"));
      setShakeError(true);
      setTimeout(() => setShakeError(false), 600);
      return;
    }

    router.push(safeNext ?? `/${locale}/dashboard`);
    router.refresh();
  }

  const trust = [
    {
      title: b("panelTrust1Title"),
      body: b("panelTrust1Body"),
      icon: (
        <path strokeLinejoin="round" d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 22.3 5 18.4 5 14V6l7-3z" />
      ),
    },
    {
      title: b("panelTrust2Title"),
      body: b("panelTrust2Body"),
      icon: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L2 8l10 5 8-4v6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 11v4c0 1 2.7 3 6 3s6-2 6-3v-4" />
        </>
      ),
    },
    {
      title: b("panelTrust3Title"),
      body: b("panelTrust3Body"),
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4.5" />
        </>
      ),
    },
  ];

  return (
    <div className="auth-page min-h-screen lg:grid lg:grid-cols-2" style={{ background: "#070B0E" }}>
      {/* ── Left brand panel (desktop) ── */}
      <aside className="auth-brand relative hidden overflow-hidden p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="auth-grid" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/wordmark-192.png" alt="AlphaSeekers" width={84} height={66} className="relative z-10" />

        <div className="relative z-10 max-w-[440px]">
          <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight xl:text-5xl">
            {b("panelHeadlineTop")}
            <br />
            <span
              style={{
                background: "linear-gradient(100deg,#00E676,#00E5FF)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {b("panelHeadlineBottom")}
            </span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: SOFT }}>
            {b("panelTagline")}
          </p>

          <ul className="mt-9 space-y-5">
            {trust.map((it, i) => (
              <li key={i} className="flex items-start gap-3.5">
                <span
                  className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px]"
                  style={{ background: "rgba(0,230,118,0.09)", border: "1px solid rgba(0,230,118,0.16)", color: GREEN }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    {it.icon}
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{it.title}</p>
                  <p className="mt-0.5 text-xs leading-snug" style={{ color: FAINT }}>
                    {it.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p
          className="relative z-10 max-w-[360px] text-sm italic leading-relaxed"
          style={{ color: SOFT, borderInlineStart: "2px solid rgba(0,230,118,0.3)", paddingInlineStart: "14px" }}
        >
          {b("panelQuote")}
        </p>
      </aside>

      {/* ── Right form panel ── */}
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-10" style={{ background: "#070B0E" }}>
        <div className="w-full max-w-[406px] animate-fade-in-up">
          {/* Mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/wordmark-192.png" alt="AlphaSeekers" width={84} height={66} />
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{ background: "rgba(0,230,118,0.07)", border: "1px solid rgba(0,230,118,0.16)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN, boxShadow: "0 0 8px #00E676" }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: GREEN }}>
              {t("secureSignIn")}
            </span>
          </div>

          <h1 className="mt-5 text-[32px] font-extrabold leading-tight tracking-tight text-white sm:text-[34px]">
            {t("welcomeLine1")} {t("welcomeLine2")}
          </h1>
          <p className="mt-2.5 text-sm" style={{ color: SOFT }}>
            {t("tagline")}
          </p>

          {/* Google first and above the password form: for a student who has a
              Gmail account this is one tap, with no password to invent now and
              none to recover later. The password form stays for everyone else. */}
          {googleEnabled ? (
            <>
              <button
                className="auth-google mt-7"
                disabled={googleSubmitting || submitting}
                onClick={() => {
                  setGoogleSubmitting(true);
                  setErrorMessage(null);
                  void signIn("google", { callbackUrl: safeNext ?? `/${locale}/dashboard` });
                }}
                type="button"
              >
                <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
                  <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 009 18z" fill="#34A853" />
                  <path d="M3.97 10.72a5.4 5.4 0 010-3.44V4.95H.96a9 9 0 000 8.1l3.01-2.33z" fill="#FBBC05" />
                  <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 00.96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
                </svg>
                <span>{googleSubmitting ? t("signingIn") : t("continueWithGoogle")}</span>
              </button>

              <div className="auth-divider" role="separator">
                <span>{t("orUseEmail")}</span>
              </div>
            </>
          ) : null}

          <form className={`${googleEnabled ? "" : "mt-7 "}flex flex-col gap-[18px]`} onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: SOFT }}>
                {t("email")}
              </label>
              <div className="auth-field">
                <span className="auth-lic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="5" width="18" height="14" rx="2.5" />
                    <path strokeLinecap="round" d="M4 7l8 5 8-5" />
                  </svg>
                </span>
                <input
                  autoComplete="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: SOFT }}>
                  {t("password")}
                </label>
                <Link href={`/${locale}/forgot-password`} className="text-xs" style={{ color: FAINT }}>
                  {t("forgot")}
                </Link>
              </div>
              <div className="auth-field">
                <span className="auth-lic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="4" y="10" width="16" height="10" rx="2.5" />
                    <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
                  </svg>
                </span>
                <input
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth-eye"
                  tabIndex={-1}
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  onClick={() => setShowPassword((p) => !p)}
                >
                  {showPassword ? (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 5.1A9.6 9.6 0 0112 5c6.5 0 10 7 10 7a13 13 0 01-3 3.8M6 6.3A13 13 0 002 12s3.5 7 10 7a9.3 9.3 0 004-.9" />
                    </svg>
                  ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div
                className={`flex items-start gap-2 rounded-xl p-3 text-sm ${shakeError ? "auth-shake" : ""}`}
                style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}
              >
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {/* dir="auto" so the browser picks direction from the text
                    itself. Without it an English message inside the RTL (fa)
                    layout renders with its punctuation detached to the wrong
                    end — ".and try again" instead of "and try again." — which
                    is exactly how these strings look until the Dari lands. */}
                <span dir="auto">{errorMessage}</span>
              </div>
            )}

            <button type="submit" disabled={submitting} className="auth-primary mt-1">
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{t("signingIn")}</span>
                </>
              ) : (
                <>
                  <span>{t("signIn")}</span>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: SOFT }}>
            {t("newToPlatform")}{" "}
            <Link href={`/${locale}/register`} className="font-bold" style={{ color: GREEN }}>
              {t("requestAccessArrow")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
