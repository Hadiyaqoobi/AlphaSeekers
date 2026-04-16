"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAutosaveForm } from "@/components/forms/use-autosave-form";

type FormState = {
  title: string;
  type: "SCHOLARSHIP" | "JOB" | "INTERNSHIP" | "GRANT";
  description: string;
  deadline: string;
  externalUrl: string;
};

const DEFAULT_FORM: FormState = {
  title: "",
  type: "SCHOLARSHIP",
  description: "",
  deadline: "",
  externalUrl: "",
};

export function OpportunityForm() {
  const router = useRouter();
  const t = useTranslations("contentForms");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<string | null>(null);

  useAutosaveForm("opportunity-form", form, (payload) => {
    setForm((current) => ({ ...current, ...(payload as FormState) }));
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    const response = await fetch("/api/opportunities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("failed") }))) as { message?: string };
      setStatus(body.message ?? t("failed"));
      return;
    }

    setStatus(t("opportunityPosted"));
    setForm(DEFAULT_FORM);
    router.refresh();
  }

  return (
    <form className="panel panel-strong space-y-3 p-4" onSubmit={submit}>
      <h2 className="text-lg font-black text-ink-main">{t("postOpportunity")}</h2>
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        placeholder={t("title")}
        required
        value={form.title}
      />
      <select
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as FormState["type"] }))}
        value={form.type}
      >
        <option value="SCHOLARSHIP">{t("scholarship")}</option>
        <option value="JOB">{t("job")}</option>
        <option value="INTERNSHIP">{t("internship")}</option>
        <option value="GRANT">{t("grant")}</option>
      </select>
      <textarea
        className="area-field"
        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
        placeholder={t("description")}
        required
        value={form.description}
      />
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))}
        required
        type="date"
        value={form.deadline}
      />
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, externalUrl: event.target.value }))}
        placeholder="External URL"
        required
        type="url"
        value={form.externalUrl}
      />
      <button className="btn-primary" type="submit">
        {t("publish")}
      </button>
      {status ? <p className="text-sm text-ink-main">{status}</p> : null}
    </form>
  );
}
