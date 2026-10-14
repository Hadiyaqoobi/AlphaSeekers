"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatKabulTime } from "@/lib/ui/kabul-time";

interface NoteEditorProps {
  classId: string;
  sessionId: string;
  initialContent: string;
  initialUpdatedAt: string | null;
}

export function NoteEditor({ classId, sessionId, initialContent, initialUpdatedAt }: NoteEditorProps) {
  const t = useTranslations("liveSession.notes");
  const locale = useLocale();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(initialUpdatedAt);
  const lastSaved = useRef<string>(initialContent);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    if (content === lastSaved.current) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${classId}/sessions/${sessionId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        lastSaved.current = content;
        setSavedAt(data.updatedAt);
      }
    } catch {
      // silent — try again on next change
    } finally {
      setSaving(false);
    }
  }, [content, classId, sessionId]);

  // Debounced auto-save (10s)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (content === lastSaved.current) return;
    timer.current = setTimeout(save, 10_000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, save]);

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return formatKabulTime(iso, locale);
  };

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("label")}
        rows={8}
        className="w-full rounded-lg border border-line bg-dark-100 px-3 py-2 text-sm text-ink-main placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-neon-500/30 focus:border-neon-400 resize-none"
      />
      <div className="flex items-center justify-between mt-2 text-xs text-ink-faint">
        <span>
          {saving ? t("saving") : savedAt ? t("savedAt", { time: formatTime(savedAt) }) : t("notSaved")}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={saving || content === lastSaved.current}
          className="text-neon-600 hover:text-neon-700 font-medium disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t("saveNow")}
        </button>
      </div>
    </div>
  );
}
