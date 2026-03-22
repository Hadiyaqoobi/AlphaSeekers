"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type ArchiveClassButtonProps = {
  classId: string;
  className?: string;
};

export function ArchiveClassButton({ classId, className }: ArchiveClassButtonProps) {
  const router = useRouter();
  const t = useTranslations("adminForms");
  const [busy, setBusy] = useState(false);

  async function archive() {
    if (busy) return;

    const ok = window.confirm("Archive this class? Students will no longer see it.");
    if (!ok) return;

    setBusy(true);

    const response = await fetch(`/api/admin/classes/${classId}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: "Archive failed" }))) as { message?: string };
      window.alert(body.message ?? "Archive failed");
      setBusy(false);
      return;
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <button className={className ?? "btn-danger"} disabled={busy} onClick={archive} type="button">
      {busy ? t("archiving") : t("archive")}
    </button>
  );
}
