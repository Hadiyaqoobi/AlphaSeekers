"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type ArchivedClassActionsProps = {
  classId: string;
  className: string;
  /** classes.edit — the same permission the restore route checks. */
  canRestore: boolean;
  /** Super admins only — the server refuses a permanent delete from anyone else. */
  canHardDelete: boolean;
};

const DANGER_BTN =
  "rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Restore and permanent delete for an archived row in the admin class list.
 * Both used to exist only on the class's own page (a banner at the top and the
 * danger zone at the bottom), so the list offered an archived class nothing but
 * "View" and it looked as if neither could be done. Delete keeps the same
 * type-the-name confirmation as the danger zone.
 */
export function ArchivedClassActions({ classId, className, canRestore, canHardDelete }: ArchivedClassActionsProps) {
  const tl = useTranslations("classLifecycle");
  const t = useTranslations("adminClassDetail");
  const router = useRouter();
  const [busy, setBusy] = useState<null | "restore" | "delete">(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(mode: "restore" | "delete") {
    setBusy(mode);
    setError(null);
    try {
      const response =
        mode === "restore"
          ? await fetch(`/api/admin/classes/${classId}/restore`, { method: "POST" })
          : await fetch(`/api/admin/classes/${classId}?mode=permanent`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? (mode === "restore" ? tl("restoreFailed") : t("actionFailed")));
        return;
      }
      setConfirmDelete(false);
      setTyped("");
      router.refresh();
    } catch {
      setError(mode === "restore" ? tl("restoreFailed") : t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  if (confirmDelete) {
    return (
      <div className="ml-auto max-w-xs space-y-2 text-left">
        <label className="block text-xs text-ink-soft" htmlFor={`delete-confirm-${classId}`}>
          {t("deleteTypePrompt", { name: className })}
        </label>
        <input
          autoComplete="off"
          autoFocus
          className="field"
          id={`delete-confirm-${classId}`}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={className}
          value={typed}
        />
        <div className="flex items-center justify-end gap-2">
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => {
              setConfirmDelete(false);
              setTyped("");
              setError(null);
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
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <>
      {canRestore ? (
        <button className="btn-primary" disabled={busy !== null} onClick={() => run("restore")} type="button">
          {busy === "restore" ? tl("restoring") : tl("restore")}
        </button>
      ) : null}
      {canHardDelete ? (
        <button
          className={DANGER_BTN}
          disabled={busy !== null}
          onClick={() => {
            setConfirmDelete(true);
            setError(null);
          }}
          type="button"
        >
          {t("deleteButton")}
        </button>
      ) : null}
      {error ? <p className="w-full text-right text-xs text-red-300">{error}</p> : null}
    </>
  );
}
