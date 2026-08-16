"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Request = {
  enrollmentId: string;
  studentId: string;
  name: string | null;
  email: string | null;
  requestedAt: string;
};

/**
 * Decide who gets into this course. Requests appear here because platform
 * access and course access are separate — an approved AlphaSeekers account does
 * not put a student in every class.
 */
export function EnrollmentRequests({ requests }: { requests: Request[] }) {
  const t = useTranslations("adminClassDetail");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState<Record<string, "APPROVED" | "REJECTED">>({});

  async function decide(enrollmentId: string, decision: "APPROVE" | "REJECT") {
    setBusy(enrollmentId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/enrollments/${enrollmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? String(res.status));
      }
      setHandled((prev) => ({
        ...prev,
        [enrollmentId]: decision === "APPROVE" ? "APPROVED" : "REJECTED",
      }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-ink-soft">{t("noRequests")}</p>;
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
      ) : null}

      <ul className="space-y-2">
        {requests.map((r) => {
          const done = handled[r.enrollmentId];
          return (
            <li
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-dark-50 p-4"
              key={r.enrollmentId}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-main">{r.name ?? r.email ?? "—"}</p>
                <p className="text-xs text-ink-faint">
                  {r.email} · {new Date(r.requestedAt).toLocaleDateString()}
                </p>
              </div>

              {done ? (
                <span
                  className={`text-sm font-semibold ${
                    done === "APPROVED" ? "text-neon-400" : "text-ink-faint"
                  }`}
                >
                  {done === "APPROVED" ? t("requestApproved") : t("requestRejected")}
                </span>
              ) : (
                <div className="flex gap-2">
                  <button
                    className="btn-primary px-4 py-2 text-xs"
                    disabled={busy === r.enrollmentId}
                    onClick={() => void decide(r.enrollmentId, "APPROVE")}
                    type="button"
                  >
                    {t("approveRequest")}
                  </button>
                  <button
                    className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-ink-soft transition hover:bg-white/5"
                    disabled={busy === r.enrollmentId}
                    onClick={() => void decide(r.enrollmentId, "REJECT")}
                    type="button"
                  >
                    {t("rejectRequest")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
