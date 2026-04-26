"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type EnrollButtonProps = {
  classId: string;
  initiallyEnrolled?: boolean;
};

export function EnrollButton({ classId, initiallyEnrolled = false }: EnrollButtonProps) {
  const router = useRouter();
  const t = useTranslations("enroll");
  const [enrolled, setEnrolled] = useState(initiallyEnrolled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    setLoading(true);
    setError(null);

    const optimisticState = true;
    setEnrolled(optimisticState);

    const response = await fetch(`/api/classes/${classId}/enroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      setEnrolled(false);
      const body = (await response.json().catch(() => ({ message: t("enrollFailed") }))) as {
        message?: string;
        code?: string;
        limit?: number;
      };
      // Server returns code "ENROLLMENT_LIMIT" with a numeric limit when the
      // student has reached MAX_ACTIVE_ENROLLMENTS — translate locally so the
      // student sees Dari on /fa/* (UAT 2026-04-26 MED-A).
      if (body.code === "ENROLLMENT_LIMIT" && typeof body.limit === "number") {
        setError(t("limitReached", { limit: body.limit }));
      } else {
        setError(body.message ?? t("enrollFailed"));
      }
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  async function drop() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/classes/${classId}/enroll`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("unenrollFailed") }))) as {
        message?: string;
      };
      setError(body.message ?? t("unenrollFailed"));
      setLoading(false);
      return;
    }

    setEnrolled(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {enrolled ? (
        <button
          className="btn-muted"
          disabled={loading}
          onClick={drop}
          type="button"
        >
          {loading ? "..." : t("enrolledTapToUnenroll")}
        </button>
      ) : (
        <button
          className="btn-primary"
          disabled={loading}
          onClick={enroll}
          type="button"
        >
          {loading ? "..." : t("enroll")}
        </button>
      )}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
