"use client";

import { useState } from "react";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";

import { useAutosaveForm } from "@/components/forms/use-autosave-form";
import { ApiError, registerUser } from "@/lib/api-client";
import { validateEmailStrict } from "@/lib/security/email";
import type { RegisterRequest } from "@/types/api-contracts";

type FormState = {
  name: string;
  email: string;
  password: string;
  role: "STUDENT" | "TEACHER";
  phone: string;
};

const DEFAULT_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  role: "STUDENT",
  phone: "",
};

const SOFT = "#93A9BC";
const FAINT = "#5F7C93";
const GREEN = "#00E676";

export default function RegisterPage() {
  const t = useTranslations("register");
  const tl = useTranslations("login");
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale || "fa";

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Exclude password from auto-save to prevent storing credentials in localStorage
  const safeForm = { name: form.name, email: form.email, role: form.role, phone: form.phone };
  useAutosaveForm("register-draft", safeForm, (payload) => {
    setForm((current) => ({ ...current, ...(payload as Partial<FormState>) }));
  });

  function localizeEmailError(result: ReturnType<typeof validateEmailStrict>): string {
    if (result.ok) return "";
    switch (result.code) {
      case "TLD_MISSING":
        return t("emailTldMissing");
      case "TLD_SHAPE":
        return t("emailTldShape");
      case "TLD_TYPO":
        return t("emailTldTypo", { tld: result.typoTld ?? "" });
      case "INVALID_FORMAT":
      default:
        return t("emailInvalid");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    // Client-side email check so users on slow connections get instant
    // feedback before the request goes out (UAT 2026-04-26 HIGH-B).
    const emailCheck = validateEmailStrict(form.email);
    if (!emailCheck.ok) {
      setMessage(localizeEmailError(emailCheck));
      return;
    }

    setSubmitting(true);

    const payload: RegisterRequest = {
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      phone: form.phone || undefined,
      language: locale === "en" ? "EN" : "FA",
      timezone: "Asia/Kabul",
    };

    try {
      await registerUser(payload);
    } catch (error) {
      const recheck = validateEmailStrict(form.email);
      if (!recheck.ok) {
        setMessage(localizeEmailError(recheck));
      } else {
        setMessage(error instanceof ApiError ? error.message : t("error"));
      }
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    // Drop the saved draft. It holds name/email/phone and nothing else cleared
    // it: the autosave survives navigation, and the only other cleanup runs on
    // LOGOUT — which an applicant awaiting approval never reaches. On a shared
    // computer (community centre, family device) the next person opening this
    // page was being shown the previous applicant's details, pre-filled. Reset
    // state first so the autosave effect cannot immediately re-persist them.
    setForm(DEFAULT_FORM);
    try {
      localStorage.removeItem("register-draft");
    } catch {
      // localStorage may be unavailable (private mode, restricted device)
    }

    router.push(`/${locale}/pending-approval`);
    router.refresh();
  }

  const trust = [
    {
      title: t("panelTrust1Title"),
      body: t("panelTrust1Body"),
      icon: <path strokeLinejoin="round" d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 22.3 5 18.4 5 14V6l7-3z" />,
    },
    {
      title: t("panelTrust2Title"),
      body: t("panelTrust2Body"),
      icon: (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L2 8l10 5 8-4v6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 11v4c0 1 2.7 3 6 3s6-2 6-3v-4" />
        </>
      ),
    },
    {
      title: t("panelTrust3Title"),
      body: t("panelTrust3Body"),
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
            {t("panelHeadlineTop")}
            <br />
            <span
              style={{
                background: "linear-gradient(100deg,#00E676,#00E5FF)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {t("panelHeadlineBottom")}
            </span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: SOFT }}>
            {t("panelTagline")}
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
          {t("panelQuote")}
        </p>
      </aside>

      {/* ── Right form panel ── */}
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-10" style={{ background: "#070B0E" }}>
        <div className="w-full max-w-[422px] animate-fade-in-up">
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
              {t("eyebrow")}
            </span>
          </div>

          <h1 className="mt-5 text-[28px] font-extrabold leading-tight tracking-tight text-white sm:text-[30px]">
            {t("title")}
          </h1>
          <p className="mt-2.5 text-sm" style={{ color: SOFT }}>
            {t("subtitle")}
          </p>

          <form className="mt-6 flex flex-col gap-[15px]" onSubmit={submit}>
            {/* Name */}
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: SOFT }}>
                {t("name")}
              </label>
              <div className="auth-field">
                <span className="auth-lic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="8" r="3.5" />
                    <path strokeLinecap="round" d="M5 20c0-3.3 3.1-5 7-5s7 1.7 7 5" />
                  </svg>
                </span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  required
                />
              </div>
            </div>

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
                  value={form.email}
                  onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Password + Phone */}
            <div className="grid grid-cols-1 gap-[15px] sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: SOFT }}>
                  {t("password")}
                </label>
                <div className="auth-field">
                  <span className="auth-lic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4" y="10" width="16" height="10" rx="2.5" />
                      <path strokeLinecap="round" d="M8 10V7a4 4 0 018 0v3" />
                    </svg>
                  </span>
                  <input
                    autoComplete="new-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: SOFT }}>
                  {t("phone")}
                </label>
                <div className="auth-field">
                  <span className="auth-lic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h3l2 5-2 1.5a12 12 0 005.5 5.5L20 19v0" />
                    </svg>
                  </span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                    placeholder="+93…"
                  />
                </div>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.11em]" style={{ color: SOFT }}>
                {t("role")}
              </label>
              <div className="auth-seg">
                <button type="button" data-on={form.role === "STUDENT"} onClick={() => setForm((c) => ({ ...c, role: "STUDENT" }))}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L2 8l10 5 8-4v6" />
                  </svg>
                  {t("student")}
                </button>
                <button type="button" data-on={form.role === "TEACHER"} onClick={() => setForm((c) => ({ ...c, role: "TEACHER" }))}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="12" cy="8" r="3.2" />
                    <path strokeLinecap="round" d="M5 20c0-3.2 3.1-5 7-5s7 1.8 7 5" />
                  </svg>
                  {t("teacher")}
                </button>
              </div>
              {/* Say what this control actually does. Registration always creates a
                  STUDENT (privilege-escalation prevention in api/auth/register); the
                  choice is recorded as a REQUEST an admin grants after review. Before
                  this note the toggle read as if it granted the role outright, and
                  applicants who picked Teacher silently became students. */}
              {form.role === "TEACHER" ? (
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: FAINT }}>
                  {t("teacherRequestNote")}
                </p>
              ) : null}
            </div>

            {message ? (
              <div
                className="flex items-start gap-2 rounded-xl p-3 text-sm"
                style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}
              >
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{message}</span>
              </div>
            ) : null}

            <button className="auth-primary mt-1" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{t("submit")}</span>
                </>
              ) : (
                <>
                  <span>{t("submit")}</span>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: SOFT }}>
            <Link href={`/${locale}/login`} className="font-bold" style={{ color: GREEN }}>
              {tl("signIn")}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
