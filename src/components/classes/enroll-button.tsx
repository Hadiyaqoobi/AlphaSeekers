"use client";

import { useState } from "react";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { isRegistrationClosed } from "@/lib/platform/registration-deadline";
import { messageForCode, readErrorBody } from "@/lib/ui/api-error";

type EnrollButtonProps = {
  classId: string;
  initiallyEnrolled?: boolean;
  /** ISO cutoff for joining, or null/undefined when the class is open indefinitely. */
  registrationDeadline?: string | null;
  /**
   * Set when the class has its own sign-up questions: joining then happens on
   * the join page, where they are asked (ADR-0009), not with one click here.
   */
  joinHref?: string;
};

export function EnrollButton({
  classId,
  initiallyEnrolled = false,
  registrationDeadline = null,
  joinHref,
}: EnrollButtonProps) {
  const router = useRouter();
  const t = useTranslations("enroll");
  const [enrolled, setEnrolled] = useState(initiallyEnrolled);
  const [loading, setLoading] = useState(false);
  // Leaving takes two taps. It used to be one: the only button on the class page
  // said "Enrolled (tap to unenroll)", and a single tap gave the seat away.
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    setLoading(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch(`/api/classes/${classId}/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch {
      setError(t("enrollFailed"));
      setLoading(false);
      return;
    }

    if (!response.ok) {
      const body = await readErrorBody(response);
      // Server returns code "ENROLLMENT_LIMIT" with a numeric limit when the
      // student has reached MAX_ACTIVE_ENROLLMENTS — translate locally so the
      // student sees Dari on /fa/* (UAT 2026-04-26 MED-A). Every other failure
      // is translated by code too; the server's English `message` is never shown.
      if (body?.code === "ENROLLMENT_LIMIT" && typeof body.limit === "number") {
        setError(t("limitReached", { limit: body.limit }));
      } else {
        setError(
          messageForCode(
            body,
            {
              CLASS_FULL: t("classFull"),
              REGISTRATION_CLOSED: t("registrationClosed"),
              ENROLLMENT_REJECTED: t("rejected"),
            },
            t("enrollFailed"),
          ),
        );
      }
      setLoading(false);
      return;
    }

    // The server enrols straight away (state "JOINED"), so flip to the enrolled
    // state now: the student sees the confirmation AND the leave button without
    // reloading the page.
    setEnrolled(true);
    setLoading(false);
    router.refresh();
  }

  async function drop() {
    setLoading(true);
    setError(null);

    let ok = false;
    try {
      const response = await fetch(`/api/classes/${classId}/enroll`, {
        method: "DELETE",
      });
      ok = response.ok;
    } catch {
      ok = false;
    }

    if (!ok) {
      setError(t("unenrollFailed"));
      setLoading(false);
      return;
    }

    setEnrolled(false);
    setConfirmingLeave(false);
    setLoading(false);
    router.refresh();
  }

  // Hiding the button is a courtesy, not the control: the server re-checks the
  // deadline inside the enrolment transaction, so a stale page cannot sneak a
  // late request through. A student who is already in the class keeps the
  // unenrol button — the cutoff governs joining, not leaving.
  const closed = !enrolled && isRegistrationClosed(registrationDeadline);

  if (closed) {
    return (
      <p className="rounded-lg border border-white/10 bg-dark-100 px-4 py-2.5 text-sm text-ink-soft">
        {t("registrationClosed")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {enrolled ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-neon-100 px-3 py-2 text-sm font-semibold text-neon-600" role="status">
              ✓ {t("inClass")}
            </span>
            {confirmingLeave ? (
              <>
                <span className="text-sm text-ink-soft">{t("leaveConfirm")}</span>
                <button className="text-sm font-semibold text-red-400 hover:underline" disabled={loading} onClick={drop} type="button">
                  {loading ? "..." : t("leaveYes")}
                </button>
                <button className="text-sm text-ink-soft hover:underline" disabled={loading} onClick={() => setConfirmingLeave(false)} type="button">
                  {t("leaveCancel")}
                </button>
              </>
            ) : (
              <button className="text-sm text-ink-faint hover:text-ink-soft hover:underline" onClick={() => setConfirmingLeave(true)} type="button">
                {t("leave")}
              </button>
            )}
          </div>
        </>
      ) : joinHref ? (
        <Link className="btn-primary inline-block" href={joinHref}>
          {t("requestToJoin")}
        </Link>
      ) : (
        <button
          className="btn-primary"
          disabled={loading}
          onClick={enroll}
          type="button"
        >
          {loading ? "..." : t("requestToJoin")}
        </button>
      )}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
