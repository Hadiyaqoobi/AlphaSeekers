"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAutosaveForm } from "@/components/forms/use-autosave-form";

type Teacher = {
  id: string;
  name: string;
  /** Shown alongside the name to tell same-named teachers apart. */
  email: string;
};

type AdminClassFormProps = {
  teachers: Teacher[];
};

type FormState = {
  name: string;
  subjectCategory: string;
  description: string;
  teacherMode: "existing" | "invite";
  teacherId: string;
  newTeacherName: string;
  newTeacherEmail: string;
  maxStudents: string;
  durationMinutes: string;
  schedulePreference: string;
  language: string;
  whatsappGroupUrl: string;
  schedulingMode: "AUTO" | "MANUAL";
};

const DEFAULT_FORM: FormState = {
  name: "",
  subjectCategory: "Languages",
  description: "",
  teacherMode: "existing",
  teacherId: "",
  newTeacherName: "",
  newTeacherEmail: "",
  maxStudents: "50",
  durationMinutes: "60",
  schedulePreference: "Tue 6:00 PM",
  language: "Dari",
  whatsappGroupUrl: "",
  schedulingMode: "AUTO",
};

export function AdminClassForm({ teachers }: AdminClassFormProps) {
  const router = useRouter();
  const t = useTranslations("adminForms");
  // Reuse the staff form's already-translated invite labels (both locales).
  const ts = useTranslations("staffForms");
  const [form, setForm] = useState<FormState>({
    ...DEFAULT_FORM,
    teacherId: teachers[0]?.id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useAutosaveForm("admin-class-create", form, (payload) => {
    setForm((current) => ({ ...current, ...(payload as FormState) }));
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    // Send ONLY the relevant instructor field for the chosen mode — sending empty
    // strings for the invite fields would fail the server-side email/min-length checks.
    const teacherFields =
      form.teacherMode === "invite"
        ? { newTeacherName: form.newTeacherName, newTeacherEmail: form.newTeacherEmail }
        : { teacherId: form.teacherId };

    const response = await fetch("/api/admin/classes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.name,
        subjectCategory: form.subjectCategory,
        description: form.description,
        schedulePreference: form.schedulePreference,
        language: form.language,
        schedulingMode: form.schedulingMode,
        maxStudents: Number(form.maxStudents),
        durationMinutes: Number(form.durationMinutes),
        ...(form.whatsappGroupUrl.trim() ? { whatsappGroupUrl: form.whatsappGroupUrl.trim() } : {}),
        ...teacherFields,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("createFailed") }))) as { message?: string };
      setMessage(body.message ?? t("createFailed"));
      setSaving(false);
      return;
    }

    setMessage(t("classCreated"));
    setSaving(false);
    setForm({
      ...DEFAULT_FORM,
      teacherId: teachers[0]?.id ?? "",
    });
    router.refresh();
  }

  return (
    <form className="panel panel-strong space-y-3 p-4" onSubmit={submit}>
      <h2 className="text-lg font-black text-ink-main">{t("createClass")}</h2>

      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        placeholder={t("className")}
        required
        value={form.name}
      />

      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, subjectCategory: event.target.value }))}
        placeholder={t("subjectCategory")}
        required
        value={form.subjectCategory}
      />

      <textarea
        className="area-field"
        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
        placeholder={t("description")}
        required
        value={form.description}
      />

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wide text-ink-faint">{ts("lecturer")}</label>
        <div className="flex gap-2">
          <button
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              form.teacherMode === "existing" ? "bg-neon-500 text-black" : "bg-dark-100 text-ink-soft"
            }`}
            onClick={() => setForm((current) => ({ ...current, teacherMode: "existing" }))}
            type="button"
          >
            {ts("existingTeacher")}
          </button>
          <button
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              form.teacherMode === "invite" ? "bg-neon-500 text-black" : "bg-dark-100 text-ink-soft"
            }`}
            onClick={() => setForm((current) => ({ ...current, teacherMode: "invite" }))}
            type="button"
          >
            {ts("inviteNew")}
          </button>
        </div>

        {form.teacherMode === "existing" ? (
          <select
            className="select-field"
            onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
            value={form.teacherId}
          >
            {/* Name AND email, matching staff-class-form. Names are not unique in
                this roster (two "Ajmal", several sharing a first name), so a
                name-only label makes the real teachers indistinguishable and the
                wrong one gets assigned to a class. */}
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} — {teacher.email}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-2">
            <input
              className="field"
              onChange={(event) => setForm((current) => ({ ...current, newTeacherName: event.target.value }))}
              placeholder={ts("newTeacherNamePlaceholder")}
              required
              value={form.newTeacherName}
            />
            <input
              className="field"
              onChange={(event) => setForm((current) => ({ ...current, newTeacherEmail: event.target.value }))}
              placeholder={ts("newTeacherEmailPlaceholder")}
              required
              type="email"
              value={form.newTeacherEmail}
            />
            <p className="text-xs text-ink-soft">{ts("inviteHint")}</p>
          </div>
        )}
      </div>

      <input
        className="field"
        min={1}
        onChange={(event) => setForm((current) => ({ ...current, maxStudents: event.target.value }))}
        placeholder={t("maxStudents")}
        required
        type="number"
        value={form.maxStudents}
      />

      <input
        className="field"
        min={30}
        onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))}
        placeholder={t("classDuration")}
        required
        type="number"
        value={form.durationMinutes}
      />

      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, schedulePreference: event.target.value }))}
        placeholder={t("schedule")}
        required
        value={form.schedulePreference}
      />

      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
        placeholder={t("language")}
        required
        value={form.language}
      />

      <input
        className="field"
        onChange={(event) => setForm((current) => ({ ...current, whatsappGroupUrl: event.target.value }))}
        placeholder="WhatsApp group link — https://chat.whatsapp.com/…"
        type="url"
        value={form.whatsappGroupUrl}
      />

      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wide text-ink-faint" htmlFor="admin-class-scheduling-mode">
          Scheduling
        </label>
        <select
          className="select-field"
          id="admin-class-scheduling-mode"
          onChange={(event) =>
            setForm((current) => ({ ...current, schedulingMode: event.target.value as FormState["schedulingMode"] }))
          }
          value={form.schedulingMode}
        >
          <option value="AUTO">Automatic — sessions scheduled from teacher availability</option>
          <option value="MANUAL">Manual — the instructor sets each session&apos;s date &amp; time</option>
        </select>
        {form.schedulingMode === "MANUAL" ? (
          <p className="text-xs text-ink-soft">
            The class is created with no sessions until the instructor adds them on their schedule page.
          </p>
        ) : null}
      </div>

      <button className="btn-primary" disabled={saving} type="submit">
        {saving ? t("saving") : t("createClassBtn")}
      </button>

      {message ? <p className="text-sm text-ink-main">{message}</p> : null}
    </form>
  );
}
