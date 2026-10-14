"use client";

import { useMemo, useState } from "react";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { DAY_ABBREVIATIONS, parseStoredWeeklySlot } from "@/lib/scheduling/weekly-slot";

type Teacher = { id: string; name: string; email: string };

/** The class as it is now, so the edit form opens filled in (it used to open empty). */
export type EditableClass = {
  name: string;
  description: string;
  teacherId: string;
  maxStudents: number;
  durationMinutes: number;
  schedulePreference: string | null;
  registrationDeadline: string | null;
  whatsappGroupUrl: string | null;
  registrationFormUrl: string | null;
};

type AdminClassActionsProps = {
  classId: string;
  initial: EditableClass;
  teachers: Teacher[];
  /** Editing needs classes.edit; without it only the CSV export is offered. */
  canEdit?: boolean;
};

type EditState = {
  name: string;
  description: string;
  teacherId: string;
  maxStudents: string;
  durationMinutes: string;
  day: string;
  time: string;
  registrationDeadline: string;
  whatsappGroupUrl: string;
  registrationFormUrl: string;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const LABEL = "text-xs font-semibold text-ink-soft";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Deadline instant → the Kabul calendar date the date input shows. */
function deadlineToKabulDate(iso: string | null): string {
  if (!iso) return "";
  const local = new Date(new Date(iso).getTime() + (4 * 60 + 30) * 60_000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

function toEditState(initial: EditableClass): EditState {
  const slot = parseStoredWeeklySlot(initial.schedulePreference);
  return {
    name: initial.name,
    description: initial.description,
    teacherId: initial.teacherId,
    maxStudents: String(initial.maxStudents),
    durationMinutes: String(initial.durationMinutes),
    day: slot ? DAY_ABBREVIATIONS[slot.dayOfWeek] : "",
    time: slot ? `${pad(slot.hour)}:${pad(slot.minute)}` : "",
    registrationDeadline: deadlineToKabulDate(initial.registrationDeadline),
    whatsappGroupUrl: initial.whatsappGroupUrl ?? "",
    registrationFormUrl: initial.registrationFormUrl ?? "",
  };
}

export function AdminClassActions({ classId, initial, teachers, canEdit = true }: AdminClassActionsProps) {
  const t = useTranslations("adminClassDetail");
  const tl = useTranslations("classLifecycle");
  const ts = useTranslations("staffForms");
  const router = useRouter();
  const original = useMemo(() => toEditState(initial), [initial]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState<EditState>(original);

  // The current teacher stays selectable even if their role later changed.
  const teacherOptions = teachers.some((teacher) => teacher.id === initial.teacherId)
    ? teachers
    : [{ id: initial.teacherId, name: initial.teacherId, email: "" }, ...teachers];

  function update<K extends keyof EditState>(key: K, value: EditState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openEditor() {
    setForm(original);
    setMessage(null);
    setEditing(true);
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    // Send only what changed, so an untouched field is never rewritten.
    const body: Record<string, unknown> = {};
    if (form.name.trim() !== original.name) body.name = form.name.trim();
    if (form.description.trim() !== original.description) body.description = form.description.trim();
    if (form.teacherId !== original.teacherId) body.teacherId = form.teacherId;
    if (form.maxStudents !== original.maxStudents) body.maxStudents = Number(form.maxStudents);
    if (form.durationMinutes !== original.durationMinutes) body.durationMinutes = Number(form.durationMinutes);
    if ((form.day !== original.day || form.time !== original.time) && form.day && form.time) {
      body.schedulePreference = `${form.day} ${form.time}`;
    }
    if (form.registrationDeadline !== original.registrationDeadline) {
      body.registrationDeadline = form.registrationDeadline || null;
    }
    if (form.whatsappGroupUrl.trim() !== original.whatsappGroupUrl) body.whatsappGroupUrl = form.whatsappGroupUrl.trim();
    if (form.registrationFormUrl.trim() !== original.registrationFormUrl) {
      body.registrationFormUrl = form.registrationFormUrl.trim();
    }

    if (Object.keys(body).length === 0) {
      setMessage({ kind: "error", text: tl("nothingChanged") });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setMessage({ kind: "ok", text: t("saved") });
        setEditing(false);
        router.refresh();
      } else {
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
          errors?: Array<{ field: string; message: string }>;
        };
        const detail = data.errors?.[0] ? `${data.errors[0].field}: ${data.errors[0].message}` : data.message;
        setMessage({ kind: "error", text: detail ? `${t("saveFailed")} — ${detail}` : t("saveFailed") });
      }
    } catch {
      setMessage({ kind: "error", text: t("saveFailed") });
    } finally {
      setSaving(false);
    }
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
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `class-${classId}-students.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const messageNode = message ? (
    <p className={`text-sm ${message.kind === "ok" ? "text-neon-400" : "text-red-300"}`} role="status">
      {message.text}
    </p>
  ) : null;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit ? (
        <button className="btn-secondary" onClick={() => (editing ? setEditing(false) : openEditor())} type="button">
          {editing ? t("cancelEdit") : t("editClass")}
        </button>
      ) : null}
      <button className="btn-secondary" onClick={handleExportCSV} type="button">
        {t("exportCSV")}
      </button>

      {editing ? (
        <form className="mt-2 w-full space-y-3 rounded-lg border border-line bg-dark-100 p-4" onSubmit={handleEdit}>
          <p className="text-xs text-ink-soft">{tl("editIntro")}</p>

          <div className="space-y-1">
            <label className={LABEL} htmlFor="edit-class-name">{tl("nameLabel")}</label>
            <input
              className="field"
              id="edit-class-name"
              onChange={(e) => update("name", e.target.value)}
              required
              value={form.name}
            />
          </div>

          <div className="space-y-1">
            <label className={LABEL} htmlFor="edit-class-description">{tl("descriptionLabel")}</label>
            <textarea
              className="area-field"
              id="edit-class-description"
              onChange={(e) => update("description", e.target.value)}
              required
              value={form.description}
            />
          </div>

          <div className="space-y-1">
            <label className={LABEL} htmlFor="edit-class-teacher">{tl("teacherLabel")}</label>
            <select
              className="select-field"
              id="edit-class-teacher"
              onChange={(e) => update("teacherId", e.target.value)}
              value={form.teacherId}
            >
              {teacherOptions.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.email ? `${teacher.name} — ${teacher.email}` : teacher.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className={LABEL} htmlFor="edit-class-day">{tl("dayLabel")}</label>
              <select
                className="select-field"
                id="edit-class-day"
                onChange={(e) => update("day", e.target.value)}
                value={form.day}
              >
                {form.day === "" ? <option value="">—</option> : null}
                {DAY_KEYS.map((key, index) => (
                  <option key={key} value={DAY_ABBREVIATIONS[index]}>
                    {ts(key)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={LABEL} htmlFor="edit-class-time">{tl("timeLabel")}</label>
              <input
                className="field"
                id="edit-class-time"
                onChange={(e) => update("time", e.target.value)}
                type="time"
                value={form.time}
              />
            </div>
            <div className="space-y-1">
              <label className={LABEL} htmlFor="edit-class-duration">{tl("durationLabel")}</label>
              <input
                className="field"
                id="edit-class-duration"
                max={600}
                min={30}
                onChange={(e) => update("durationMinutes", e.target.value)}
                step={5}
                type="number"
                value={form.durationMinutes}
              />
            </div>
          </div>
          <p className="text-xs text-ink-faint">{tl("scheduleChangeHint")}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={LABEL} htmlFor="edit-class-max">{tl("maxStudentsLabel")}</label>
              <input
                className="field"
                id="edit-class-max"
                max={1000}
                min={1}
                onChange={(e) => update("maxStudents", e.target.value)}
                type="number"
                value={form.maxStudents}
              />
            </div>
            <div className="space-y-1">
              <label className={LABEL} htmlFor="edit-class-deadline">{ts("registrationDeadlineLabel")}</label>
              <input
                className="field"
                id="edit-class-deadline"
                onChange={(e) => update("registrationDeadline", e.target.value)}
                type="date"
                value={form.registrationDeadline}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className={LABEL} htmlFor="edit-class-whatsapp">{tl("whatsappLabel")}</label>
            <input
              className="field"
              id="edit-class-whatsapp"
              onChange={(e) => update("whatsappGroupUrl", e.target.value)}
              placeholder="https://chat.whatsapp.com/…"
              type="url"
              value={form.whatsappGroupUrl}
            />
          </div>

          <div className="space-y-1">
            <label className={LABEL} htmlFor="edit-class-form">{tl("ownFormLabel")}</label>
            <input
              className="field"
              id="edit-class-form"
              onChange={(e) => update("registrationFormUrl", e.target.value)}
              placeholder="https://forms.gle/…"
              type="url"
              value={form.registrationFormUrl}
            />
          </div>

          <button className="btn-primary" disabled={saving} type="submit">
            {saving ? "…" : t("saveChanges")}
          </button>
          {messageNode}
        </form>
      ) : null}

      {!editing ? messageNode : null}
    </div>
  );
}
