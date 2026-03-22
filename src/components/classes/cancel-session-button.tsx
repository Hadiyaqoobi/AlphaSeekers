"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type CancelSessionButtonProps = {
  sessionId: string;
  classId: string;
};

export function CancelSessionButton({ sessionId, classId }: CancelSessionButtonProps) {
  const t = useTranslations("sessionActions");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCancel() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/classes/${classId}/sessions/${sessionId}/cancel`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("failed");
      router.refresh();
    } catch {
      // Revert
    }
    setSubmitting(false);
    setConfirming(false);
  }

  return (
    <button
      className="text-xs font-medium text-red-600 hover:text-red-800"
      disabled={submitting}
      onClick={handleCancel}
      type="button"
    >
      {submitting ? "..." : confirming ? t("confirmCancel") : t("cancel")}
    </button>
  );
}
