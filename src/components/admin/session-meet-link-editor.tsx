"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Paste a session's Meet link by hand. The fallback for when Google is not
 * connected or generating a link failed: without it, a session with no link had
 * no way in at all. Saves via PATCH /api/teacher/classes/[classId]/sessions.
 */
export function SessionMeetLinkEditor({
  classId,
  sessionId,
  initialLink,
}: {
  classId: string;
  sessionId: string;
  initialLink: string | null;
}) {
  const t = useTranslations("classLifecycle");
  const router = useRouter();
  const [link, setLink] = useState(initialLink ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/teacher/classes/${classId}/sessions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, meetLink: link.trim() || null }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setMessage({ kind: "error", text: body.message ?? t("meetLinkFailed") });
        return;
      }
      setMessage({ kind: "ok", text: t("meetLinkSaved") });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: t("meetLinkFailed") });
    } finally {
      setBusy(false);
    }
  }

  const inputId = `meet-link-${sessionId}`;
  return (
    <form className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={save}>
      <label className="sr-only" htmlFor={inputId}>
        {t("meetLinkLabel")}
      </label>
      <input
        className="field flex-1 text-xs"
        id={inputId}
        onChange={(event) => setLink(event.target.value)}
        placeholder="https://meet.google.com/…"
        type="url"
        value={link}
      />
      <button className="btn-secondary text-xs" disabled={busy} type="submit">
        {t("meetLinkSave")}
      </button>
      {message ? (
        <span className={`text-xs ${message.kind === "ok" ? "text-neon-400" : "text-red-300"}`} role="status">
          {message.text}
        </span>
      ) : null}
    </form>
  );
}
