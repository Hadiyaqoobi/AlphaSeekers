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
      const body = (await response.json().catch(() => ({ message: t("failed") }))) as { message?: string };
      setStatus(body.message ?? t("failed"));
      return;
    }

    setStatus(t("webinarPublished"));
    setForm(DEFAULT_FORM);
    router.refresh();
  }

  return (
    <form className="panel panel-strong space-y-3 p-4" onSubmit={submit}>
      <h2 className="text-lg font-black text-ink-main">{t("createWebinar")}</h2>
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        placeholder={t("title")}
        required
        value={form.title}
      />
      <textarea
        className="area-field"
        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
        placeholder={t("description")}
        required
        value={form.description}
      />
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
        required
        type="datetime-local"
        value={form.startsAt}
      />
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, meetLink: event.target.value }))}
        placeholder={t("meetLink")}
        required
        type="url"
        value={form.meetLink}
      />
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
        placeholder={t("language")}
        required
        value={form.language}
      />
      <button className="btn-primary" type="submit">
        {t("publishWebinar")}
      </button>
      {status ? <p className="text-sm text-ink-main">{status}</p> : null}
    </form>
  );
}
