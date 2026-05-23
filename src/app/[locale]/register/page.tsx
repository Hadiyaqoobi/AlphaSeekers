"use client";

import { useState } from "react";

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

export default function RegisterPage() {
  const t = useTranslations("register");
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale || "fa";

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Exclude password from auto-save to prevent storing credentials in localStorage
  const safeForm = { name: form.name, email: form.email, role: form.role, phone: form.phone };
  useAutosaveForm("register-draft", safeForm, (payload) => {
    setForm((current) => ({ ...current, ...payload as Partial<FormState> }));
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
      // The server may reject the email even if our pre-check passed
      // (race against a stricter server policy). Re-run the validator
      // so we can show the localized message rather than the raw
      // English fallback from the API.
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
    router.push(`/${locale}/pending-approval`);
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2" style={{ background: "#080D12" }}>
      {/* -------- Left branding panel (desktop only) -------- */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden p-12 text-white" style={{ background: "#080D12" }}>
        {/* Atmospheric green glow */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 60%, rgba(0,230,118,0.18) 0%, transparent 60%)" }} />
        {/* Subtle wave image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/brand-wave.jpg" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-15 scale-110" style={{ filter: "blur(1px)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 30%, #080D12 90%)" }} />

        {/* Top logo */}
        <div className="relative z-10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/wordmark-96.png"
            alt="AlphaSeekers"
            width={51}
            height={40}
          />
        </div>

        {/* Center copy */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
              {t("panelHeadlineTop")}<br />{t("panelHeadlineBottom")}
            </h2>
            <p className="max-w-sm text-lg leading-relaxed text-neon-100/80">
              {t("panelTagline")}
            </p>
          </div>

          {/* Trust points */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-100/10 backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neon-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t("panelTrust1Title")}</p>
                <p className="text-xs text-neon-200/60">{t("panelTrust1Body")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-100/10 backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neon-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t("panelTrust2Title")}</p>
                <p className="text-xs text-neon-200/60">{t("panelTrust2Body")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-100/10 backdrop-blur-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neon-300" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{t("panelTrust3Title")}</p>
                <p className="text-xs text-neon-200/60">{t("panelTrust3Body")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom quote (Malala) */}
        <p className="relative z-10 max-w-xs text-sm italic leading-relaxed text-neon-200/60">
          {t("panelQuote")}
        </p>
      </div>

      {/* -------- Right form panel -------- */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)] px-6 py-12 lg:min-h-0 lg:overflow-y-auto lg:px-16">
        {/* Mobile-only branding header */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/wordmark-192.png"
            alt="AlphaSeekers"
            width={61}
            height={48}
          />
        </div>

        <div className="w-full max-w-md animate-fade-in-up">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-main">
              {t("title")}
            </h1>
            <p className="mt-2 text-base text-ink-soft">{t("subtitle")}</p>
          </div>

          {/* Form card */}
          <form
            className="space-y-5 rounded-2xl p-8"
            style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
            onSubmit={submit}
          >
            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-ink-main">{t("name")}</span>
              <input
                className="field min-h-[3rem] text-base"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                value={form.name}
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-ink-main">{t("email")}</span>
              <input
                autoComplete="email"
                className="field min-h-[3rem] text-base"
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-ink-main">{t("password")}</span>
              <input
                autoComplete="new-password"
                className="field min-h-[3rem] text-base"
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                required
                type="password"
                value={form.password}
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-ink-main">{t("phone")}</span>
              <input
                className="field min-h-[3rem] text-base"
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+93..."
                value={form.phone}
              />
            </label>

            {/* Role selector as pill buttons */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink-main">{t("role")}</legend>
              <div className="flex gap-2 rounded-xl bg-dark-100 p-1">
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, role: "STUDENT" }))}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    form.role === "STUDENT"
                      ? "bg-dark-100 text-neon-700 shadow-sm ring-1 ring-line-DEFAULT/80"
                      : "text-ink-soft hover:text-ink-main"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
                    </svg>
                    {t("student")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, role: "TEACHER" }))}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    form.role === "TEACHER"
                      ? "bg-dark-100 text-neon-700 shadow-sm ring-1 ring-line-DEFAULT/80"
                      : "text-ink-soft hover:text-ink-main"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    {t("teacher")}
                  </span>
                </button>
              </div>
            </fieldset>

            {message ? (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{message}</span>
              </div>
            ) : null}

            <button
              className="btn-primary w-full min-h-[3rem] text-base"
              disabled={submitting}
              type="submit"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>{t("submit")}</span>
                </span>
              ) : (
                t("submit")
              )}
            </button>
          </form>

          {/* Mobile trust points */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center lg:hidden">
            <div className="rounded-xl bg-neon-50 px-3 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-1 h-5 w-5 text-neon-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <p className="text-xs font-semibold text-neon-800">{t("mobileTrust1")}</p>
            </div>
            <div className="rounded-xl bg-neon-50 px-3 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-1 h-5 w-5 text-neon-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-xs font-semibold text-neon-800">{t("mobileTrust2")}</p>
            </div>
            <div className="rounded-xl bg-neon-50 px-3 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-1 h-5 w-5 text-neon-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
              </svg>
              <p className="text-xs font-semibold text-neon-800">{t("mobileTrust3")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
