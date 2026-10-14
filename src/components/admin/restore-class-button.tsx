"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Undo an archive. The danger zone always promised "you can restore it later";
 * this is the button that makes it true (POST /api/admin/classes/[id]/restore).
 */
export function RestoreClassButton({ classId }: { classId: string }) {
  const t = useTranslations("classLifecycle");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/classes/${classId}/restore`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? t("restoreFailed"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("restoreFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-primary" disabled={busy} onClick={restore} type="button">
        {busy ? t("restoring") : t("restore")}
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
