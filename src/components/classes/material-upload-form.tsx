"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { FileUpload } from "@/components/classes/file-upload";
import { useAutosaveForm } from "@/components/forms/use-autosave-form";

type MaterialUploadFormProps = {
  classId: string;
};

type FormState = {
  title: string;
  fileUrl: string;
  fileSize: string;
};

const DEFAULT_FORM: FormState = {
  title: "",
  fileUrl: "",
  fileSize: "",
};

export function MaterialUploadForm({ classId }: MaterialUploadFormProps) {
  const router = useRouter();
  const t = useTranslations("materials");
  const tUpload = useTranslations("upload");
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useAutosaveForm(`material-upload-${classId}`, form, (payload) => {
    setForm((current) => ({ ...current, ...(payload as FormState) }));
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const response = await fetch(`/api/classes/${classId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: form.title,
        fileUrl: form.fileUrl,
        fileSize: Number(form.fileSize),
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("uploadFailed") }))) as { message?: string };
      setMessage(body.message ?? t("uploadFailed"));
      setSaving(false);
      return;
    }

    setMessage(t("uploaded"));
    setSaving(false);
    setForm(DEFAULT_FORM);
    router.refresh();
  }

  return (
    <form className="stat-card space-y-2 p-3" onSubmit={submit}>
      <h3 className="text-sm font-black text-ink-main">{t("title")}</h3>
      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        placeholder={t("placeholders.title")}
        required
        value={form.title}
      />
      <FileUpload
        classId={classId}
        onUploadComplete={(url, size) =>
          setForm((current) => ({ ...current, fileUrl: url, fileSize: String(size) }))
        }
        purpose="material"
      />

      {/* Uploading needs object storage, which is not configured on this server.
          A pasted link (Drive, OneDrive, a public PDF) works either way, so the
          teacher is never blocked waiting on infrastructure. */}
      <div className="space-y-1 border-t border-white/10 pt-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="material-link">
          {t("orPasteLink")}
        </label>
        <input
          className="field"
          id="material-link"
          onChange={(event) =>
            setForm((current) => ({ ...current, fileUrl: event.target.value, fileSize: "0" }))
          }
          placeholder="https://drive.google.com/..."
          type="url"
          value={form.fileUrl.startsWith("http") ? form.fileUrl : ""}
        />
        <p className="text-xs text-ink-faint">{t("linkHint")}</p>
      </div>
      {form.fileUrl ? (
        <div className="flex items-center gap-2 text-sm text-neon-700">
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{tUpload("fileSelected")}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          disabled={saving || !form.title || !form.fileUrl}
          type="submit"
        >
          {saving ? "..." : t("save")}
        </button>
        {message ? <p className="text-xs text-ink-soft">{message}</p> : null}
      </div>
    </form>
  );
}
