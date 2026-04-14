"use client";

import { useState } from "react";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const t = useTranslations("login");
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
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    const err = searchParams.get("error");
    return err === "PENDING_APPROVAL" ? t("pending") : null;
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setErrorMessage(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setSubmitting(false);

    if (!result || !result.ok) {
      const pending = result?.error === "PENDING_APPROVAL" || result?.url?.includes("PENDING_APPROVAL");
      setErrorMessage(pending ? t("pending") : t("error"));
      setShakeError(true);
      setTimeout(() => setShakeError(false), 600);
      return;
    }

    router.push(safeNext ?? `/${locale}/dashboard`);
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* -------- Left branding panel (desktop only) -------- */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 p-12 text-white">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-white/[0.03]" />

        {/* Top logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-base font-bold backdrop-blur-sm">
            A
          </div>
          <span className="text-lg font-semibold tracking-tight">AlphaSeekers</span>
        </div>

        {/* Center copy */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
            Welcome back.
          </h2>
          <p className="max-w-sm text-lg leading-relaxed text-emerald-100/80">
            Continue your learning journey. Every lesson brings you one step closer to mastery.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold ring-2 ring-emerald-800">H</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-400 text-xs font-bold ring-2 ring-emerald-800">S</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold ring-2 ring-emerald-800">A</span>
            </div>
            <span className="text-sm text-emerald-200/70">500+ students learning</span>
          </div>
        </div>

        {/* Bottom quote */}
        <p className="relative z-10 max-w-xs text-sm italic leading-relaxed text-emerald-200/60">
          &ldquo;Education is the most powerful weapon which you can use to change the world.&rdquo;
        </p>
      </div>

      {/* -------- Right form panel -------- */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)] px-6 py-12 lg:min-h-0 lg:px-16">
        {/* Mobile-only branding header */}
        <div className="mb-10 flex flex-col items-center lg:hidden">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-lg font-bold text-white shadow-lg shadow-emerald-200/50">
            A
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-700">AlphaSeekers</span>
        </div>

        <div className="w-full max-w-md animate-fade-in-up">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {t("title")}
            </h1>
            <p className="mt-2 text-base text-slate-500">{t("subtitle")}</p>
          </div>

          {/* Form card */}
          <form
            className="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-8 shadow-md shadow-slate-200/50"
            onSubmit={handleSubmit}
          >
            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-slate-700">{t("email")}</span>
              <input
                autoComplete="email"
                className="field min-h-[3rem] text-base"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="font-semibold text-slate-700">{t("password")}</span>
              <div className="relative">
                <input
                  autoComplete="current-password"
                  className="field min-h-[3rem] text-base !pr-12"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {errorMessage ? (
              <div className={`flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200/60 ${shakeError ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{errorMessage}</span>
                <style>{`
                  @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                  }
                `}</style>
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

          {/* Request access link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                className="font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-2 transition-colors hover:text-emerald-800 hover:decoration-emerald-500"
                href={`/${locale}/register`}
              >
                {t("requestAccess")}
              </Link>
            </p>
          </div>

          {/* Social proof (mobile) */}
          <div className="mt-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex -space-x-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[0.65rem] font-bold text-emerald-700 ring-2 ring-white">H</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[0.65rem] font-bold text-teal-700 ring-2 ring-white">S</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[0.65rem] font-bold text-emerald-700 ring-2 ring-white">A</span>
            </div>
            <span className="text-xs text-slate-400">500+ students learning</span>
          </div>
        </div>
      </div>
    </div>
  );
}
