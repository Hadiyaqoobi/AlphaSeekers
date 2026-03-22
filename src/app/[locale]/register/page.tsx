"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";

import { useAutosaveForm } from "@/components/forms/use-autosave-form";
import { ApiError, registerUser } from "@/lib/api-client";
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    setSubmitting(true);
    setMessage(null);

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
      setMessage(error instanceof ApiError ? error.message : t("error"));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push(`/${locale}/pending-approval`);
    router.refresh();
  }

  return (
    <section className="auth-page mx-auto w-full max-w-sm px-4 py-12 sm:py-16">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white shadow-md shadow-emerald-200">A</div>
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("subtitle")}</p>
      </div>

      <form className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm" onSubmit={submit}>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">{t("name")}</span>
          <input
            className="field"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
            value={form.name}
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">{t("email")}</span>
          <input
            autoComplete="email"
            className="field"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
            type="email"
            value={form.email}
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">{t("password")}</span>
          <input
            autoComplete="new-password"
            className="field"
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            required
            type="password"
            value={form.password}
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">{t("phone")}</span>
          <input
            className="field"
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="+93..."
            value={form.phone}
          />
        </label>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-slate-700">{t("role")}</span>
          <select
            className="select-field"
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as FormState["role"] }))}
            value={form.role}
          >
            <option value="STUDENT">{t("student")}</option>
            <option value="TEACHER">{t("teacher")}</option>
          </select>
        </label>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}

        <button className="btn-primary w-full" disabled={submitting} type="submit">
          {submitting ? "..." : t("submit")}
        </button>
      </form>
    </section>
  );
}
