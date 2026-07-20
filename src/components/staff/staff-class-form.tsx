"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { useAutosaveForm } from "@/components/forms/use-autosave-form";

type Teacher = {
    id: string;
    name: string;
    email: string;
};

type StaffClassFormProps = {
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
    day: string;
    time: string;
    frequency: string;
    language: string;
    materialUrl: string;
    registrationFormUrl: string;
    whatsappGroupUrl: string;
    schedulingMode: "AUTO" | "MANUAL";
};

type CreatedResult = {
    class: { id: string; name: string };
    sessions: Array<{ startTime: string; endTime: string; meetLink: string | null; meetLinkStatus: string }>;
    registrationUrl: string;
    registrationFormUrl: string | null;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_VALUES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQUENCY_KEYS = ["weekly", "biweekly", "daily"] as const;
const CATEGORY_KEYS = [
    "languages",
    "english",
    "stem",
    "artsDesign",
    "professionalSkills",
    "journalism",
    "healthWellbeing",
    "other",
] as const;
const CATEGORY_VALUES = [
    "Languages",
    "English",
    "STEM",
    "Arts & Design",
    "Professional Skills",
    "Journalism",
    "Health & Wellbeing",
    "Other",
];

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
    day: "Tue",
    time: "18:00",
    frequency: "weekly",
    language: "Dari",
    materialUrl: "",
    registrationFormUrl: "",
    whatsappGroupUrl: "",
    schedulingMode: "AUTO",
};

export function StaffClassForm({ teachers }: StaffClassFormProps) {
    const t = useTranslations("staffForms");
    const [form, setForm] = useState<FormState>({
        ...DEFAULT_FORM,
        teacherId: teachers[0]?.id ?? "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CreatedResult | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    useAutosaveForm("staff-class-create", form, (payload) => {
        setForm((current) => ({ ...current, ...(payload as FormState) }));
    });

    function formatTimeTo12h(time24: string) {
        const [hourStr, minuteStr] = time24.split(":");
        let hour = Number(hourStr);
        const amPm = hour >= 12 ? "PM" : "AM";
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
        return `${hour}:${minuteStr} ${amPm}`;
    }

    const selectedTeacher = teachers.find((teacher) => teacher.id === form.teacherId);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setResult(null);

        const schedulePreference = `${form.day} ${formatTimeTo12h(form.time)}`;

        const payload: Record<string, unknown> = {
            name: form.name,
            subjectCategory: form.subjectCategory,
            description: form.description,
            maxStudents: Number(form.maxStudents),
            durationMinutes: Number(form.durationMinutes),
            schedulePreference,
            language: form.language,
            registrationFormUrl: form.registrationFormUrl || undefined,
            whatsappGroupUrl: form.whatsappGroupUrl || undefined,
            schedulingMode: form.schedulingMode,
        };

        if (form.teacherMode === "invite") {
            payload.newTeacherName = form.newTeacherName;
            payload.newTeacherEmail = form.newTeacherEmail;
        } else {
            payload.teacherId = form.teacherId;
        }

        const response = await fetch("/api/staff/classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const body = (await response.json().catch(() => ({ message: t("createFailed") }))) as {
                message?: string;
            };
            setError(body.message ?? t("createFailed"));
            setSaving(false);
            return;
        }

        const data = (await response.json()) as CreatedResult;
        setResult(data);
        setSaving(false);
        setForm({ ...DEFAULT_FORM, teacherId: teachers[0]?.id ?? "" });
    }

    function copyToClipboard(text: string, fieldName: string) {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    }

    function resetForm() {
        setResult(null);
        setError(null);
    }

    // Get the translated frequency label for the current selection
    function getFrequencyLabel(value: string) {
        const index = ["weekly", "biweekly", "daily"].indexOf(value);
        if (index >= 0) return t(FREQUENCY_KEYS[index]);
        return value;
    }

    // ── Success panel ─────────────────────────────────────────────────────
    if (result) {
        return (
            <div className="panel panel-strong space-y-4 p-5">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neon-100 text-neon-600">
                        ✓
                    </span>
                    <h2 className="text-xl font-black text-ink-main">{t("classCreated")}</h2>
                </div>

                <p className="text-sm text-ink-soft">
                    {t("classLiveMessage", { name: result.class.name })}
                </p>

                <div className="space-y-3">
                    {/* Registration link */}
                    <div className="rounded-lg border border-line bg-dark-100 p-3">
                        <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                            {t("registrationLinkLabel")}
                        </label>
                        <div className="mt-1 flex items-center gap-2">
                            <code className="flex-1 truncate rounded bg-dark-50 px-2 py-1 text-sm text-ink-main">
                                {result.registrationUrl}
                            </code>
                            <button
                                className="btn-secondary shrink-0 text-xs"
                                onClick={() => copyToClipboard(result.registrationUrl, "registration")}
                                type="button"
                            >
                                {copiedField === "registration" ? t("copied") : t("copy")}
                            </button>
                        </div>
                    </div>

                    {/* Meet link */}
                    {result.sessions[0]?.meetLink ? (
                        <div className="rounded-lg border border-line bg-dark-100 p-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                                {t("meetLinkLabel")}
                            </label>
                            <div className="mt-1 flex items-center gap-2">
                                <code className="flex-1 truncate rounded bg-dark-50 px-2 py-1 text-sm text-ink-main">
                                    {result.sessions[0].meetLink}
                                </code>
                                <button
                                    className="btn-secondary shrink-0 text-xs"
                                    onClick={() => copyToClipboard(result.sessions[0].meetLink!, "meet")}
                                    type="button"
                                >
                                    {copiedField === "meet" ? t("copied") : t("copy")}
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-ink-soft">
                                {t("firstSession", { time: new Date(result.sessions[0].startTime).toLocaleString() })}
                            </p>
                        </div>
                    ) : null}

                    {/* Session timeline */}
                    {result.sessions.length > 0 ? (
                        <div className="rounded-lg border border-line bg-dark-100 p-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                                {t("timelineLabel")}
                            </label>
                            <div className="mt-2 space-y-1">
                                {result.sessions.map((session, index) => (
                                    <div className="flex items-center gap-2 text-sm text-ink-main" key={index}>
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                                            {index + 1}
                                        </span>
                                        <span>{new Date(session.startTime).toLocaleString()}</span>
                                        <span className="text-ink-faint">→</span>
                                        <span>{new Date(session.endTime).toLocaleTimeString()}</span>
                                        {session.meetLink ? (
                                            <span className="ml-auto rounded bg-neon-50 px-1.5 py-0.5 text-xs font-semibold text-neon-600">
                                                {t("meetReady")} ✓
                                            </span>
                                        ) : (
                                            <span className="ml-auto rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-600">
                                                {t("pending")}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* Google Form */}
                    {result.registrationFormUrl ? (
                        <div className="rounded-lg border border-line bg-dark-100 p-3">
                            <label className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                                {t("googleFormLabel")}
                            </label>
                            <div className="mt-1 flex items-center gap-2">
                                <code className="flex-1 truncate rounded bg-dark-50 px-2 py-1 text-sm text-ink-main">
                                    {result.registrationFormUrl}
                                </code>
                                <button
                                    className="btn-secondary shrink-0 text-xs"
                                    onClick={() => copyToClipboard(result.registrationFormUrl!, "form")}
                                    type="button"
                                >
                                    {copiedField === "form" ? t("copied") : t("copy")}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                <button className="btn-primary w-full" onClick={resetForm} type="button">
                    {t("createAnother")}
                </button>
            </div>
        );
    }

    // ── Class creation form ───────────────────────────────────────────────
    return (
        <form className="panel panel-strong space-y-4 p-4" onSubmit={submit}>
            <h2 className="text-lg font-black text-ink-main">{t("createClass")}</h2>
            <p className="text-xs text-ink-soft">
                {t("formSubtitle")}
            </p>

            {/* ── Class details ──────── */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wide text-ink-faint">{t("classDetails")}</legend>

                <input
                    className="field"
                    id="staff-class-name"
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder={t("classNamePlaceholder")}
                    required
                    value={form.name}
                />

                <select
                    className="select-field"
                    id="staff-class-category"
                    onChange={(event) => setForm((current) => ({ ...current, subjectCategory: event.target.value }))}
                    value={form.subjectCategory}
                >
                    {CATEGORY_KEYS.map((key, index) => (
                        <option key={key} value={CATEGORY_VALUES[index]}>
                            {t(key)}
                        </option>
                    ))}
                </select>

                <textarea
                    className="area-field"
                    id="staff-class-description"
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder={t("descriptionPlaceholder")}
                    required
                    rows={3}
                    value={form.description}
                />

                <input
                    className="field"
                    id="staff-class-language"
                    onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
                    placeholder={t("language")}
                    required
                    value={form.language}
                />
            </fieldset>

            {/* ── Lecturer ──────── */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wide text-ink-faint">{t("lecturer")}</legend>

                <div className="flex gap-2">
                    <button
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${form.teacherMode === "existing" ? "bg-indigo-600 text-white" : "bg-dark-100 text-ink-soft"}`}
                        onClick={() => setForm((current) => ({ ...current, teacherMode: "existing" }))}
                        type="button"
                    >
                        {t("existingTeacher")}
                    </button>
                    <button
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${form.teacherMode === "invite" ? "bg-indigo-600 text-white" : "bg-dark-100 text-ink-soft"}`}
                        onClick={() => setForm((current) => ({ ...current, teacherMode: "invite" }))}
                        type="button"
                    >
                        {t("inviteNew")}
                    </button>
                </div>

                {form.teacherMode === "existing" ? (
                    <>
                        <select
                            className="select-field"
                            id="staff-class-teacher"
                            onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
                            value={form.teacherId}
                        >
                            {teachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                    {teacher.name} — {teacher.email}
                                </option>
                            ))}
                        </select>
                        {selectedTeacher ? (
                            <p className="text-xs text-ink-soft">
                                {selectedTeacher.email}
                            </p>
                        ) : null}
                    </>
                ) : (
                    <>
                        <input
                            className="field"
                            id="staff-class-new-teacher-name"
                            onChange={(event) => setForm((current) => ({ ...current, newTeacherName: event.target.value }))}
                            placeholder={t("newTeacherNamePlaceholder")}
                            required
                            value={form.newTeacherName}
                        />
                        <input
                            className="field"
                            id="staff-class-new-teacher-email"
                            onChange={(event) => setForm((current) => ({ ...current, newTeacherEmail: event.target.value }))}
                            placeholder={t("newTeacherEmailPlaceholder")}
                            required
                            type="email"
                            value={form.newTeacherEmail}
                        />
                        <p className="text-xs text-ink-soft">{t("inviteHint")}</p>
                    </>
                )}
            </fieldset>

            {/* ── Schedule ──────── */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wide text-ink-faint">{t("schedule")}</legend>

                <div className="space-y-1">
                    <label
                        className="text-xs font-semibold text-ink-soft"
                        htmlFor="staff-class-scheduling-mode"
                    >
                        Scheduling
                    </label>
                    <select
                        className="select-field"
                        id="staff-class-scheduling-mode"
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                schedulingMode: event.target.value as FormState["schedulingMode"],
                            }))
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

                <div className="grid grid-cols-3 gap-3">
                    <select
                        className="select-field"
                        id="staff-class-day"
                        onChange={(event) => setForm((current) => ({ ...current, day: event.target.value }))}
                        value={form.day}
                    >
                        {DAY_KEYS.map((key, index) => (
                            <option key={key} value={DAY_VALUES[index]}>
                                {t(key)}
                            </option>
                        ))}
                    </select>

                    <input
                        className="field"
                        id="staff-class-time"
                        onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                        required
                        type="time"
                        value={form.time}
                    />

                    <select
                        className="select-field"
                        id="staff-class-frequency"
                        onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}
                        value={form.frequency}
                    >
                        {FREQUENCY_KEYS.map((key) => (
                            <option key={key} value={key}>
                                {t(key)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <input
                        className="field"
                        id="staff-class-duration"
                        min={30}
                        onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))}
                        placeholder={t("durationPlaceholder")}
                        required
                        type="number"
                        value={form.durationMinutes}
                    />

                    <input
                        className="field"
                        id="staff-class-max-students"
                        min={1}
                        onChange={(event) => setForm((current) => ({ ...current, maxStudents: event.target.value }))}
                        placeholder={t("maxStudents")}
                        required
                        type="number"
                        value={form.maxStudents}
                    />
                </div>

                <p className="text-xs text-ink-faint">
                    {t("preview", {
                        day: t(DAY_KEYS[DAY_VALUES.indexOf(form.day)] ?? "sun"),
                        time: formatTimeTo12h(form.time),
                        frequency: getFrequencyLabel(form.frequency),
                        duration: form.durationMinutes,
                    })}
                </p>
            </fieldset>

            {/* ── Optional extras ──────── */}
            <fieldset className="space-y-3">
                <legend className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                    {t("optionalExtras")}
                </legend>

                <input
                    className="field"
                    id="staff-class-material-url"
                    onChange={(event) => setForm((current) => ({ ...current, materialUrl: event.target.value }))}
                    placeholder={t("materialUrlPlaceholder")}
                    type="url"
                    value={form.materialUrl}
                />

                <input
                    className="field"
                    id="staff-class-form-url"
                    onChange={(event) => setForm((current) => ({ ...current, registrationFormUrl: event.target.value }))}
                    placeholder={t("formUrlPlaceholder")}
                    type="url"
                    value={form.registrationFormUrl}
                />

                <input
                    className="field"
                    id="staff-class-whatsapp-url"
                    onChange={(event) => setForm((current) => ({ ...current, whatsappGroupUrl: event.target.value }))}
                    placeholder="WhatsApp group link — https://chat.whatsapp.com/…"
                    type="url"
                    value={form.whatsappGroupUrl}
                />
            </fieldset>

            <button className="btn-primary w-full" disabled={saving} id="staff-class-submit" type="submit">
                {saving ? t("saving") : t("submitBtn")}
            </button>

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
        </form>
    );
}
