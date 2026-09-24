"use client";

/**
 * Remove a student from a class.
 *
 * The counterweight to immediate joining: since nobody approves a join any
 * more, the teacher needs to be able to take someone out. Two taps, because a
 * one-tap remove next to a name is far too easy to hit by accident on a phone,
 * and this is somebody's access to their education.
 */

import { useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type RemoveStudentButtonProps = {
  classId: string;
  studentId: string;
  studentName: string;
};

export function RemoveStudentButton({ classId, studentId, studentName }: RemoveStudentButtonProps) {
  const t = useTranslations("classDetail");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/classes/${classId}/students/${studentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? t("removeFailed"));
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError(t("removeFailed"));
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        aria-label={t("removeStudentAria", { name: studentName })}
        className="text-xs font-semibold text-ink-faint hover:text-red-500"
        onClick={() => setConfirming(true)}
        type="button"
      >
        {t("remove")}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-xs text-red-500" dir="auto">{error}</span> : null}
      <button
        className="text-xs font-bold text-red-500 disabled:opacity-60"
        disabled={busy}
        onClick={remove}
        type="button"
      >
        {busy ? t("removing") : t("confirmRemove")}
      </button>
      <button
        className="text-xs text-ink-faint"
        disabled={busy}
        onClick={() => setConfirming(false)}
        type="button"
      >
        {t("cancel")}
      </button>
    </span>
  );
}
