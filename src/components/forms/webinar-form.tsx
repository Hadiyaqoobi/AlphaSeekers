"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAutosaveForm } from "@/components/forms/use-autosave-form";

type FormState = {
  title: string;
  description: string;
  startsAt: string;
  meetLink: string;
  language: string;
};

const DEFAULT_FORM: FormState = {
  title: "",
  description: "",
  startsAt: "",
  meetLink: "",
  language: "Dari",
};

export function WebinarForm() {
  const router = useRouter();
  const t = useTranslations("contentForms");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<string | null>(null);

  useAutosaveForm("webinar-form", form, (payload) => {
    setForm((current) => ({ ...current, ...(payload as FormState) }));
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    const startsAt = form.startsAt ? new Date(form.startsAt).toISOString() : "";

    const response = await fetch("/api/webinars", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        startsAt,
      }),
    });

    if (!response.ok) {
      // Translated fallback; the server's English `message` is not shown.
      setStatus(t("failed"));
      return;
    }

    setStatus(t("webinarPublished"));
    setForm(DEFAULT_FORM);
    router.refresh();
  }

  return (
    <form className="panel panel-strong space-y-3 p-4" onSubmit={submit}>
      <h2 className="text-lg font-black text-ink-main">{t("createWebinar")}</h2>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink-soft">{t("title")}</span>
        <input
          className="field"
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder={t("title")}
          required
          value={form.title}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink-soft">{t("description")}</span>
        <textarea
          className="area-field"
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder={t("description")}
          required
          value={form.description}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink-soft">{t("startsAt")}</span>
        <input
          className="field"
          onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
          required
          type="datetime-local"
          value={form.startsAt}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink-soft">{t("meetLink")}</span>
        <input
          className="field"
          onChange={(event) => setForm((current) => ({ ...current, meetLink: event.target.value }))}
          placeholder={t("meetLink")}
          required
          type="url"
          value={form.meetLink}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink-soft">{t("language")}</span>
        <input
          className="field"
          onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
          placeholder={t("language")}
          required
          value={form.language}
        />
      </label>
      <button className="btn-primary" type="submit">
        {t("publishWebinar")}
      </button>
      {status ? <p className="text-sm text-ink-main">{status}</p> : null}
    </form>
  );
}
