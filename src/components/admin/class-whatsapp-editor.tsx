"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

type ClassWhatsAppEditorProps = {
  classId: string;
  initialUrl: string | null;
};

/**
 * Admin-side editor for a class's WhatsApp group invite link. Saving PATCHes
 * /api/admin/classes/[id]. Once set, enrolled students see a "Join WhatsApp
 * group" button on the class page and receive the link in their welcome email.
 */
export function ClassWhatsAppEditor({ classId, initialUrl }: ClassWhatsAppEditorProps) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/admin/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappGroupUrl: url.trim() }),
    });
    setSaving(false);
    if (response.ok) {
      setMessage("Saved");
      router.refresh();
    } else {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(body.message ?? "Could not save");
    }
  }

  return (
    <div className="panel p-4 sm:p-5">
      <label className="text-xs font-bold uppercase tracking-wide text-ink-faint" htmlFor="class-whatsapp-url">
        WhatsApp group link
      </label>
      <p className="mt-1 text-xs text-ink-soft">
        Paste the class WhatsApp group invite. Enrolled students get a “Join WhatsApp group” button and the link
        in their welcome email. Leave blank to remove it.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="field flex-1"
          id="class-whatsapp-url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://chat.whatsapp.com/…"
          type="url"
          value={url}
        />
        <button className="btn-primary" disabled={saving} onClick={save} type="button">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {message ? <p className="mt-2 text-xs text-ink-main">{message}</p> : null}
    </div>
  );
}
