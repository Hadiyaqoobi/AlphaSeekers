"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { FileUpload } from "@/components/classes/file-upload";
import { useAutosaveForm } from "@/components/forms/use-autosave-form";

type FormState = {
  title: string;
  author: string;
  category: string;
  fileUrl: string;
  fileSize: string;
  externalUrl: string;
};

const DEFAULT_FORM: FormState = {
  title: "",
  author: "",
  category: "",
  fileUrl: "",
  fileSize: "",
  externalUrl: "",
};

export function LibraryForm() {
  const router = useRouter();
  const t = useTranslations("contentForms");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<string | null>(null);

  useAutosaveForm("library-form", form, (payload) => {
    setForm((current) => ({ ...current, ...(payload as FormState) }));
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    const response = await fetch("/api/library", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        fileSize: Number(form.fileSize),
        externalUrl: form.externalUrl || undefined,
      }),
    });

    if (!response.ok) {
      // Translated fallback; the server's English `message` is not shown.
      setStatus(t("failed"));
      return;
    }

    setStatus(t("resourceAdded"));
    setForm(DEFAULT_FORM);
    router.refresh();
  }

  return (
    <form className="panel panel-strong space-y-3 p-4" onSubmit={submit}>
      <h2 className="text-lg font-black text-ink-main">{t("addLibrary")}</h2>
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
        <span className="text-xs font-semibold text-ink-soft">{t("author")}</span>
        <input
          className="field"
          onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))}
          placeholder={t("author")}
          required
          value={form.author}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink-soft">{t("category")}</span>
        <input
          className="field"
          onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          placeholder={t("category")}
          required
          value={form.category}
        />
      </label>
      <FileUpload
        onUploadComplete={(url, size) =>
          setForm((current) => ({ ...current, fileUrl: url, fileSize: String(size) }))
        }
        purpose="library"
      />
      {form.fileUrl ? (
        <p className="text-xs text-neon-600">{t("fileAttached")}</p>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-ink-soft">{t("fileUrl")}</span>
          <input
            className="field"
            onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value }))}
            placeholder={t("fileUrl")}
            type="url"
            value={form.fileUrl}
          />
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ink-soft">{t("externalUrl")}</span>
        <input
          className="field"
          onChange={(event) => setForm((current) => ({ ...current, externalUrl: event.target.value }))}
          placeholder={t("externalUrl")}
          type="url"
          value={form.externalUrl}
        />
      </label>
      <button className="btn-primary" type="submit">
        {t("addResource")}
      </button>
      {status ? <p className="text-sm text-ink-main">{status}</p> : null}
    </form>
  );
}
