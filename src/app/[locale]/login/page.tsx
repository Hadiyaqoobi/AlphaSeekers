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
  const [submitting, setSubmitting] = useState(false);
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
      return;
    }

    router.push(safeNext ?? `/${locale}/dashboard`);
    router.refresh();
  }

  return (
    <section className="auth-page mx-auto w-full max-w-sm px-4 py-12 sm:py-16">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white shadow-md shadow-emerald-200">A</div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
      </div>

      <form className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">{t("email")}</span>
          <input
            autoComplete="email"
            className="field"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">{t("password")}</span>
          <input
            autoComplete="current-password"
            className="field"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          className="btn-primary w-full"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "..." : t("submit")}
        </button>

      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link className="font-medium text-emerald-700 hover:underline" href={`/${locale}/register`}>
          {t("requestAccess")}
        </Link>
      </p>
    </section>
  );
}
