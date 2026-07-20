"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type AdminClassActionsProps = {
  classId: string;
};

export function AdminClassActions({ classId }: AdminClassActionsProps) {
  const t = useTranslations("adminClassDetail");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    maxStudents: "",
  });

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const body: Record<string, unknown> = {};
    if (form.name.trim()) body.name = form.name.trim();
    if (form.description.trim()) body.description = form.description.trim();
    if (form.maxStudents.trim()) body.maxStudents = Number(form.maxStudents);

    if (Object.keys(body).length === 0) {
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/admin/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      setMessage(t("saved"));
      setEditing(false);
      setForm({ name: "", description: "", maxStudents: "" });
      router.refresh();
    } else {
      setMessage(t("saveFailed"));
    }
    setSaving(false);
  }

  function handleExportCSV() {
    const table = document.querySelector("table");
    if (!table) return;

    const rows: string[][] = [];
    table.querySelectorAll("tr").forEach((row) => {
      const cells: string[] = [];
      row.querySelectorAll("th, td").forEach((cell) => {
        cells.push(`"${(cell.textContent ?? "").replace(/"/g, '""')}"`);
      });
      rows.push(cells);
    });

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `class-${classId}-students.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" onClick={() => setEditing(!editing)} type="button">
        {editing ? t("cancelEdit") : t("editClass")}
      </button>
      <button className="btn-secondary" onClick={handleExportCSV} type="button">
        {t("exportCSV")}
      </button>

      {editing ? (
        <form className="mt-2 w-full rounded-lg border border-line bg-dark-100 p-4 space-y-3" onSubmit={handleEdit}>
          <input
            className="field"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t("editName")}
            value={form.name}
          />
          <textarea
            className="area-field"
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t("editDescription")}
            value={form.description}
          />
          <input
            className="field"
            onChange={(e) => setForm((f) => ({ ...f, maxStudents: e.target.value }))}
            placeholder={t("editMaxStudents")}
            type="number"
            value={form.maxStudents}
          />
          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "..." : t("saveChanges")}
          </button>
          {message ? <p className="text-sm text-ink-main">{message}</p> : null}
        </form>
      ) : null}

      {message && !editing ? <p className="text-sm text-ink-main">{message}</p> : null}
    </div>
  );
}
