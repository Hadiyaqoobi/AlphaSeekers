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
      const body = (await response.json().catch(() => ({ message: t("failed") }))) as { message?: string };
      setStatus(body.message ?? t("failed"));
      return;
    }

    setStatus(t("resourceAdded"));
    setForm(DEFAULT_FORM);
    router.refresh();
  }

  return (
    <form className="panel panel-strong space-y-3 p-4" onSubmit={submit}>
      <h2 className="text-lg font-black text-ink-main">{t("addLibrary")}</h2>
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        placeholder={t("title")}
        required
        value={form.title}
      />
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))}
        placeholder={t("author")}
        required
        value={form.author}
      />
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
        placeholder={t("category")}
        required
        value={form.category}
      />
      <FileUpload
        onUploadComplete={(url, size) =>
          setForm((current) => ({ ...current, fileUrl: url, fileSize: String(size) }))
        }
        purpose="library"
      />
      {form.fileUrl ? (
        <p className="text-xs text-neon-600">File uploaded to R2</p>
      ) : (
        <input
          className="field"
          onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value }))}
          placeholder={t("fileUrl")}
          type="url"
          value={form.fileUrl}
        />
      )}
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, externalUrl: event.target.value }))}
        placeholder={t("externalUrl")}
        type="url"
        value={form.externalUrl}
      />
      <button className="btn-primary" type="submit">
        {t("addResource")}
      </button>
      {status ? <p className="text-sm text-ink-main">{status}</p> : null}
    </form>
  );
}
