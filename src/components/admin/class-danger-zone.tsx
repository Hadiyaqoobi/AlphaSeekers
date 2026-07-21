"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type ClassDangerZoneProps = {
  classId: string;
  className: string;
  locale: string;
  /** Super admins only — hard delete is irreversible. */
  canHardDelete: boolean;
  /** Where to send the user after archive/delete. Defaults to the admin list. */
  returnTo?: string;
};

const DANGER_BTN =
  "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50";
const WARN_BTN =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Detail-page danger zone: Archive (soft, recoverable, hides the class from
 * students) and — for super admins only — permanent delete behind a
 * type-the-name confirmation so it can't be triggered by a stray click.
 */
export function ClassDangerZone({ classId, className, locale, canHardDelete, returnTo }: ClassDangerZoneProps) {
  const t = useTranslations("adminClassDetail");
  const router = useRouter();
  const [busy, setBusy] = useState<null | "archive" | "delete">(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(mode: "archive" | "delete") {
    setBusy(mode);
    setError(null);
    const url =
      mode === "delete"
        ? `/api/admin/classes/${classId}?mode=permanent`
        : `/api/admin/classes/${classId}`;

    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? t("actionFailed"));
      setBusy(null);
      return;
    }

    // The class is now gone (or hidden) — leave the detail page for the list.
    router.push(returnTo ?? `/${locale}/admin/classes`);
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-black text-red-200">{t("dangerZone")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("dangerZoneDesc")}</p>
      </div>

      {/* Archive — recoverable */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-dark-100 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-main">{t("archiveTitle")}</p>
          <p className="text-xs text-ink-soft">{t("archiveDesc")}</p>
        </div>
        {confirmArchive ? (
          <div className="flex items-center gap-2">
            <button className="btn-secondary" disabled={busy !== null} onClick={() => setConfirmArchive(false)} type="button">
              {t("cancel")}
            </button>
            <button className={WARN_BTN} disabled={busy !== null} onClick={() => run("archive")} type="button">
              {busy === "archive" ? t("archiving") : t("archiveConfirm")}
            </button>
          </div>
        ) : (
          <button
            className="btn-secondary"
            onClick={() => {
              setConfirmArchive(true);
              setConfirmDelete(false);
              setError(null);
            }}
            type="button"
          >
            {t("archiveButton")}
          </button>
        )}
      </div>

      {/* Permanent delete — super admin only */}
      {canHardDelete ? (
        <div className="rounded-lg border border-red-500/40 bg-dark-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-200">{t("deleteTitle")}</p>
              <p className="text-xs text-ink-soft">{t("deleteDesc")}</p>
            </div>
            {!confirmDelete ? (
              <button
                className={DANGER_BTN}
                onClick={() => {
                  setConfirmDelete(true);
                  setConfirmArchive(false);
                  setError(null);
                }}
                type="button"
              >
                {t("deleteButton")}
              </button>
            ) : null}
          </div>

          {confirmDelete ? (
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-ink-soft" htmlFor="delete-confirm-name">
                {t("deleteTypePrompt", { name: className })}
              </label>
              <input
                autoComplete="off"
                className="field"
                id="delete-confirm-name"
                onChange={(e) => setTyped(e.target.value)}
                placeholder={className}
                value={typed}
              />
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    setConfirmDelete(false);
                    setTyped("");
                  }}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className={DANGER_BTN}
                  disabled={busy !== null || typed.trim() !== className.trim()}
                  onClick={() => run("delete")}
                  type="button"
                >
                  {busy === "delete" ? t("deleting") : t("deleteConfirmButton")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </section>
  );
}
