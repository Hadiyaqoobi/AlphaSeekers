"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { JoinQuestionsEditor, toPayload, type DraftQuestion } from "@/components/classes/join-questions-editor";
import { useAutosaveForm } from "@/components/forms/use-autosave-form";
import { formatDateTime } from "@/lib/format-date";

/**
 * THE "post a class" form, used on both /staff/classes/create and /admin/classes.
 *
 * There used to be two different forms: the admin one had a free-text schedule
 * that silently became Saturday 5:00 PM when typed any other way, the staff one
 * had "frequency" and "material link" fields that were never sent. Staff are
 * volunteers who found posting a class confusing, so this one keeps to three
 * questions — what, who, when — with everything optional folded away, and ends on
 * a single "Copy link for WhatsApp" button.
 */

type Teacher = {
    id: string;
    name: string;
    email: string;
};

type ClassCreateFormProps = {
    teachers: Teacher[];
    /** Separate drafts per page, so a half-filled form on one is not shown on the other. */
    autosaveKey?: string;
};

type FormState = {
    name: string;
    subjectCategory: string;
    description: string;
    language: string;
    teacherMode: "existing" | "invite";
    teacherId: string;
    newTeacherName: string;
    newTeacherEmail: string;
    day: string;
    time: string;
    durationMinutes: string;
    manualDates: boolean;
    maxStudents: string;
    registrationDeadline: string;
    whatsappGroupUrl: string;
    registrationFormUrl: string;
    joinQuestions: DraftQuestion[];
};

type CreatedResult = {
    class: { id: string; name: string };
    sessions: Array<{ startTime: string; endTime: string; meetLink: string | null; meetLinkStatus: string }>;
    registrationUrl: string;
    scheduleIssue?: string | null;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_VALUES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

const ISSUE_KEYS: Record<string, string> = {
    "no-availability": "issueNoAvailability",
    "outside-availability": "issueOutsideAvailability",
    unparseable: "issueUnparseable",
    clash: "issueClash",
    "already-handled": "issueAlreadyHandled",
};

const DEFAULT_FORM: FormState = {
    name: "",
    subjectCategory: "Languages",
    description: "",
    language: "Dari",
    teacherMode: "existing",
    teacherId: "",
    newTeacherName: "",
    newTeacherEmail: "",
    day: "Tue",
    time: "18:00",
    durationMinutes: "60",
    manualDates: false,
    maxStudents: "50",
    registrationDeadline: "",
    whatsappGroupUrl: "",
    registrationFormUrl: "",
    joinQuestions: [],
};

const LABEL = "text-xs font-semibold text-ink-soft";
const LEGEND = "text-xs font-bold uppercase tracking-wide text-ink-faint";

export function ClassCreateForm({ teachers, autosaveKey = "class-create" }: ClassCreateFormProps) {
    const t = useTranslations("classLifecycle");
    // Day names, subject names and the invite wording are already translated here.
    const ts = useTranslations("staffForms");
    const tq = useTranslations("joinQuestions");
    const locale = useLocale();
    const router = useRouter();
    const [form, setForm] = useState<FormState>({
        ...DEFAULT_FORM,
        teacherId: teachers[0]?.id ?? "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CreatedResult | null>(null);
    const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

    useAutosaveForm(autosaveKey, form, (payload) => {
        setForm((current) => ({ ...current, ...(payload as Partial<FormState>) }));
    });

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setResult(null);

        const payload: Record<string, unknown> = {
            name: form.name,
            subjectCategory: form.subjectCategory,
            description: form.description,
            language: form.language,
            // Sent as separate fields; the server builds the stored "Tue 6:00 PM"
            // and rejects anything it cannot read instead of guessing.
            day: form.day,
            time: form.time,
            durationMinutes: Number(form.durationMinutes),
            schedulingMode: form.manualDates ? "MANUAL" : "AUTO",
            maxStudents: Number(form.maxStudents),
            ...(form.registrationDeadline ? { registrationDeadline: form.registrationDeadline } : {}),
            ...(form.whatsappGroupUrl.trim() ? { whatsappGroupUrl: form.whatsappGroupUrl.trim() } : {}),
            ...(form.registrationFormUrl.trim() ? { registrationFormUrl: form.registrationFormUrl.trim() } : {}),
            ...(form.joinQuestions.length ? { joinQuestions: toPayload(form.joinQuestions) } : {}),
        };

        // Send ONLY the instructor fields for the chosen mode — empty invite fields
        // would fail the server-side email/min-length checks.
        if (form.teacherMode === "invite") {
            payload.newTeacherName = form.newTeacherName;
            payload.newTeacherEmail = form.newTeacherEmail;
        } else {
            payload.teacherId = form.teacherId;
        }

        try {
            const response = await fetch("/api/staff/classes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const body = (await response.json().catch(() => ({}))) as { message?: string };
                setError(body.message ?? t("createFailed"));
                return;
            }

            setResult((await response.json()) as CreatedResult);
            // The page around the form (class counts, the class list) is server
            // rendered; refresh it so the new class shows without a reload.
            router.refresh();
            setCopyState("idle");
            setForm({ ...DEFAULT_FORM, teacherId: teachers[0]?.id ?? "" });
        } catch {
            setError(t("createFailed"));
        } finally {
            setSaving(false);
        }
    }

    // ── Success screen ────────────────────────────────────────────────────
    if (result) {
        const firstSession = result.sessions[0] ?? null;
        const meetLink = firstSession?.meetLink ?? null;
        const whatsappText = [
            result.class.name,
            `${t("whatsappJoinLine")} ${result.registrationUrl}`,
            meetLink ? `${t("whatsappMeetLine")} ${meetLink}` : null,
        ]
            .filter(Boolean)
            .join("\n");
        const issueKey = result.scheduleIssue ? ISSUE_KEYS[result.scheduleIssue] : null;

        async function copyForWhatsApp() {
            try {
                await navigator.clipboard.writeText(whatsappText);
                setCopyState("copied");
            } catch {
                setCopyState("failed");
            }
        }

        return (
            <div className="panel panel-strong space-y-4 p-5">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neon-100 text-neon-600">
                        ✓
                    </span>
                    <h2 className="text-xl font-black text-ink-main">{t("createdTitle")}</h2>
                </div>

                <p className="text-sm text-ink-soft">{t("createdBody")}</p>

                <pre className="whitespace-pre-wrap break-all rounded-lg border border-line bg-dark-100 p-3 text-sm text-ink-main">
                    {whatsappText}
                </pre>

                <button
                    className="btn-primary w-full py-3 text-base"
                    id="class-copy-whatsapp"
                    onClick={copyForWhatsApp}
                    type="button"
                >
                    {copyState === "copied" ? t("copiedForWhatsApp") : t("copyForWhatsApp")}
                </button>
                {copyState === "failed" ? <p className="text-xs text-red-600">{t("copyFailed")}</p> : null}

                {firstSession ? (
                    <p className="text-sm text-ink-main">
                        {t("firstSessionAt", { time: formatDateTime(firstSession.startTime, locale) })}
                    </p>
                ) : null}
                {firstSession && !meetLink ? <p className="text-xs text-ink-soft">{t("meetPending")}</p> : null}
                {issueKey ? (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                        {t(issueKey)}
                    </p>
                ) : null}
                {!firstSession && !issueKey ? <p className="text-xs text-ink-soft">{t("manualCreated")}</p> : null}

                <div className="flex flex-wrap gap-2">
                    <Link className="btn-secondary" href={`/${locale}/admin/classes/${result.class.id}`}>
                        {t("openClass")}
                    </Link>
                    <button className="btn-secondary" onClick={() => setResult(null)} type="button">
                        {t("createAnother")}
                    </button>
                </div>
            </div>
        );
    }

    // ── Form ──────────────────────────────────────────────────────────────
    return (
        <form className="panel panel-strong space-y-5 p-4" onSubmit={submit}>
            <div>
                <h2 className="text-lg font-black text-ink-main">{t("formTitle")}</h2>
                <p className="mt-1 text-xs text-ink-soft">{t("formSubtitle")}</p>
            </div>

            {/* ── What ── */}
            <fieldset className="space-y-3">
                <legend className={LEGEND}>{t("sectionWhat")}</legend>

                <div className="space-y-1">
                    <label className={LABEL} htmlFor="class-name">{t("nameLabel")}</label>
                    <input
                        className="field"
                        id="class-name"
                        onChange={(event) => update("name", event.target.value)}
                        placeholder={ts("classNamePlaceholder")}
                        required
                        value={form.name}
                    />
                </div>

                <div className="space-y-1">
                    <label className={LABEL} htmlFor="class-category">{t("categoryLabel")}</label>
                    <select
                        className="select-field"
                        id="class-category"
                        onChange={(event) => update("subjectCategory", event.target.value)}
                        value={form.subjectCategory}
                    >
                        {CATEGORY_KEYS.map((key, index) => (
                            <option key={key} value={CATEGORY_VALUES[index]}>
                                {ts(key)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className={LABEL} htmlFor="class-description">{t("descriptionLabel")}</label>
                    <textarea
                        className="area-field"
                        id="class-description"
                        onChange={(event) => update("description", event.target.value)}
                        required
                        rows={3}
                        value={form.description}
                    />
                </div>

                <div className="space-y-1">
                    <label className={LABEL} htmlFor="class-language">{t("languageLabel")}</label>
                    <input
                        className="field"
                        id="class-language"
                        onChange={(event) => update("language", event.target.value)}
                        required
                        value={form.language}
                    />
                </div>
            </fieldset>

            {/* ── Who teaches ── */}
            <fieldset className="space-y-3">
                <legend className={LEGEND}>{t("sectionWho")}</legend>

                <div className="flex gap-2">
                    <button
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${form.teacherMode === "existing" ? "bg-indigo-600 text-white" : "bg-dark-100 text-ink-soft"}`}
                        onClick={() => update("teacherMode", "existing")}
                        type="button"
                    >
                        {ts("existingTeacher")}
                    </button>
                    <button
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${form.teacherMode === "invite" ? "bg-indigo-600 text-white" : "bg-dark-100 text-ink-soft"}`}
                        onClick={() => update("teacherMode", "invite")}
                        type="button"
                    >
                        {ts("inviteNew")}
                    </button>
                </div>

                {form.teacherMode === "existing" ? (
                    <div className="space-y-1">
                        <label className={LABEL} htmlFor="class-teacher">{t("teacherLabel")}</label>
                        {/* Name AND email: names are not unique in this roster, so a
                            name-only list gets the wrong teacher assigned. */}
                        <select
                            className="select-field"
                            id="class-teacher"
                            onChange={(event) => update("teacherId", event.target.value)}
                            required
                            value={form.teacherId}
                        >
                            {teachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                    {teacher.name} — {teacher.email}
                                </option>
                            ))}
                        </select>
                        {teachers.length === 0 ? <p className="text-xs text-ink-soft">{t("noTeachers")}</p> : null}
                    </div>
                ) : (
                    <>
                        <input
                            className="field"
                            id="class-new-teacher-name"
                            onChange={(event) => update("newTeacherName", event.target.value)}
                            placeholder={ts("newTeacherNamePlaceholder")}
                            required
                            value={form.newTeacherName}
                        />
                        <input
                            className="field"
                            id="class-new-teacher-email"
                            onChange={(event) => update("newTeacherEmail", event.target.value)}
                            placeholder={ts("newTeacherEmailPlaceholder")}
                            required
                            type="email"
                            value={form.newTeacherEmail}
                        />
                        <p className="text-xs text-ink-soft">{ts("inviteHint")}</p>
                    </>
                )}
            </fieldset>

            {/* ── When ── */}
            <fieldset className="space-y-3">
                <legend className={LEGEND}>{t("sectionWhen")}</legend>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                        <label className={LABEL} htmlFor="class-day">{t("dayLabel")}</label>
                        <select
                            className="select-field"
                            id="class-day"
                            onChange={(event) => update("day", event.target.value)}
                            value={form.day}
                        >
                            {DAY_KEYS.map((key, index) => (
                                <option key={key} value={DAY_VALUES[index]}>
                                    {ts(key)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={LABEL} htmlFor="class-time">{t("timeLabel")}</label>
                        <input
                            className="field"
                            id="class-time"
                            onChange={(event) => update("time", event.target.value)}
                            required
                            type="time"
                            value={form.time}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className={LABEL} htmlFor="class-duration">{t("durationLabel")}</label>
                        <input
                            className="field"
                            id="class-duration"
                            max={600}
                            min={30}
                            onChange={(event) => update("durationMinutes", event.target.value)}
                            required
                            step={5}
                            type="number"
                            value={form.durationMinutes}
                        />
                    </div>
                </div>
                <p className="text-xs text-ink-faint">{t("whenHint")}</p>

                <label className="flex items-start gap-2 text-sm text-ink-main" htmlFor="class-manual-dates">
                    <input
                        checked={form.manualDates}
                        className="mt-1"
                        id="class-manual-dates"
                        onChange={(event) => update("manualDates", event.target.checked)}
                        type="checkbox"
                    />
                    <span>{t("manualLabel")}</span>
                </label>
                {form.manualDates ? <p className="text-xs text-ink-soft">{t("manualHint")}</p> : null}
            </fieldset>

            {/* ── Questions for students: what the team used a Google Form for.
                 Open by default once any are chosen, so they are not forgotten. ── */}
            <details className="rounded-lg border border-line p-3" open={form.joinQuestions.length > 0}>
                <summary className="cursor-pointer text-sm font-semibold text-ink-main">
                    {tq("editor.title")}
                    {form.joinQuestions.length > 0 ? ` (${form.joinQuestions.length})` : ""}
                </summary>
                <div className="mt-3">
                    <JoinQuestionsEditor
                        idPrefix="class-create-q"
                        onChange={(next) => update("joinQuestions", next)}
                        value={form.joinQuestions}
                    />
                </div>
            </details>

            {/* ── More options (collapsed) ── */}
            <details className="rounded-lg border border-line p-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink-main">{t("moreOptions")}</summary>
                <div className="mt-3 space-y-3">
                    <div className="space-y-1">
                        <label className={LABEL} htmlFor="class-max-students">{t("maxStudentsLabel")}</label>
                        <input
                            className="field"
                            id="class-max-students"
                            max={1000}
                            min={1}
                            onChange={(event) => update("maxStudents", event.target.value)}
                            required
                            type="number"
                            value={form.maxStudents}
                        />
                    </div>

                    {/* Blank = the class stays open, which is how every class behaved
                        before this field existed. */}
                    <div className="space-y-1">
                        <label className={LABEL} htmlFor="class-registration-deadline">
                            {ts("registrationDeadlineLabel")}
                        </label>
                        <input
                            className="field"
                            id="class-registration-deadline"
                            onChange={(event) => update("registrationDeadline", event.target.value)}
                            type="date"
                            value={form.registrationDeadline}
                        />
                        <p className="text-xs text-ink-faint">{ts("registrationDeadlineHint")}</p>
                    </div>

                    <div className="space-y-1">
                        <label className={LABEL} htmlFor="class-whatsapp-url">{t("whatsappLabel")}</label>
                        <input
                            className="field"
                            id="class-whatsapp-url"
                            onChange={(event) => update("whatsappGroupUrl", event.target.value)}
                            placeholder="https://chat.whatsapp.com/…"
                            type="url"
                            value={form.whatsappGroupUrl}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className={LABEL} htmlFor="class-form-url">{t("ownFormLabel")}</label>
                        <input
                            className="field"
                            id="class-form-url"
                            onChange={(event) => update("registrationFormUrl", event.target.value)}
                            placeholder="https://forms.gle/…"
                            type="url"
                            value={form.registrationFormUrl}
                        />
                    </div>
                </div>
            </details>

            <button className="btn-primary w-full" disabled={saving} id="class-submit" type="submit">
                {saving ? t("submitting") : t("submit")}
            </button>

            {error ? (
                <p className="text-sm font-medium text-red-600" role="alert">
                    {error}
                </p>
            ) : null}
        </form>
    );
}

/** Same form; the old name is kept for the staff page import. */
export const StaffClassForm = ClassCreateForm;
