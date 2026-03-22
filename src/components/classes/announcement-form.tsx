"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type AnnouncementFormProps = {
  classId: string;
};

export function AnnouncementForm({ classId }: AnnouncementFormProps) {
  const t = useTranslations("announcements");
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/classes/${classId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (!response.ok) throw new Error("failed");

      setContent("");
      setMessage(t("sent"));
      router.refresh();
    } catch {
      setMessage(t("failed"));
    }

    setSubmitting(false);
  }

  return (
    <form className="mt-3 space-y-2" onSubmit={submit}>
      <textarea
        className="field min-h-[60px] resize-y"
        maxLength={500}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("placeholder")}
        rows={2}
        value={content}
      />
      <div className="flex items-center gap-3">
        <button className="btn-primary text-sm" disabled={submitting || !content.trim()} type="submit">
          {submitting ? "..." : t("send")}
        </button>
        {message ? <p className="text-xs text-slate-500">{message}</p> : null}
      </div>
    </form>
  );
}
