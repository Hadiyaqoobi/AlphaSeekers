"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAutosaveForm } from "@/components/forms/use-autosave-form";

type Teacher = {
  id: string;
  name: string;
};

type AdminClassFormProps = {
  teachers: Teacher[];
};

type FormState = {
  name: string;
  subjectCategory: string;
  description: string;
  teacherId: string;
  maxStudents: string;
  durationMinutes: string;
  schedulePreference: string;
  language: string;
};

const DEFAULT_FORM: FormState = {
  name: "",
  subjectCategory: "Languages",
  description: "",
  teacherId: "",
  maxStudents: "50",
  durationMinutes: "60",
  schedulePreference: "Tue 6:00 PM",
  language: "Dari",
};

export function AdminClassForm({ teachers }: AdminClassFormProps) {
  const router = useRouter();
  const t = useTranslations("adminForms");
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

    const response = await fetch("/api/admin/classes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        maxStudents: Number(form.maxStudents),
        durationMinutes: Number(form.durationMinutes),
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

      <select
        className="select-field"
        onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
        value={form.teacherId}
      >
        {teachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>
            {teacher.name}
          </option>
        ))}
      </select>

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

      <button className="btn-primary" disabled={saving} type="submit">
        {saving ? t("saving") : t("createClassBtn")}
      </button>

      {message ? <p className="text-sm text-ink-main">{message}</p> : null}
    </form>
  );
}
