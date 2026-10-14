"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";

import { DirArrow } from "@/components/ui/dir-arrow";
import { formatKabulLongDate, formatKabulTime } from "@/lib/ui/kabul-time";

type Student = {
    studentId: string;
    studentName: string;
    studentEmail: string;
    attended: boolean;
    joinedAt: string | null;
    checkinVerified?: boolean;
    checkinAt?: string | null;
};

type SessionData = {
    sessionId: string;
    classId: string;
    className: string;
    startTime: string;
    endTime: string;
    students: Student[];
};

type SummaryStudent = {
    studentId: string;
    studentName: string;
    studentEmail: string;
    sessionsAttended: number;
    sessionsVerified?: number;
    totalSessions: number;
    attendanceRate: number;
    verificationRate?: number;
};

type SummaryData = {
    classId: string;
    totalSessions: number;
    totalStudents: number;
    students: SummaryStudent[];
};

function formatTime(iso: string | null | undefined, locale: string): string | null {
    if (!iso) return null;
    return formatKabulTime(iso, locale);
}

/** Fetch JSON, treating any non-2xx (403/404/500) as "no data" instead of crashing on it. */
async function fetchJsonOrNull<T>(url: string): Promise<T | null> {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
}

export function AttendanceSheet({
    sessionId,
    locale,
}: {
    sessionId: string;
    locale: string;
}) {
    const t = useTranslations("attendance");
    const [data, setData] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        fetchJsonOrNull<SessionData>(`/api/classes/sessions/${sessionId}/attendance`)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [sessionId]);

    async function toggleAttendance(studentId: string, attended: boolean) {
        setSaving(studentId);
        setSaveError(null);
        const previous = data?.students.find((s) => s.studentId === studentId) ?? null;
        const apply = (patch: Partial<Student> | null) =>
            setData((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    students: prev.students.map((s) =>
                        s.studentId === studentId ? (patch ? { ...s, ...patch } : s) : s,
                    ),
                };
            });
        // Show the change straight away, then put it back if the server refused
        // it — a teacher must never see "present" for a mark that was not saved.
        apply({ attended, joinedAt: attended ? new Date().toISOString() : null });
        try {
            const res = await fetch(`/api/classes/sessions/${sessionId}/attendance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId, attended }),
            });
            if (!res.ok) throw new Error(String(res.status));
        } catch {
            if (previous) apply({ attended: previous.attended, joinedAt: previous.joinedAt });
            setSaveError(t("saveFailed"));
        } finally {
            setSaving(null);
        }
    }

    if (loading) {
        return (
            <div className="panel panel-strong p-6 text-center text-ink-soft">
                {t("loading")}
            </div>
        );
    }

    if (!data) {
        return (
            <div className="panel panel-strong p-6 text-center text-ink-soft">
                {t("sessionNotFound")}
            </div>
        );
    }

    const presentCount = data.students.filter((s) => s.attended).length;
    const verifiedCount = data.students.filter((s) => s.checkinVerified).length;

    return (
        <section className="space-y-4">
            <header className="hero-panel p-5">
                <Link
                    className="text-sm font-semibold text-indigo-600 hover:underline"
                    href={`/${locale}/classes/${data.classId}`}
                >
                    <DirArrow back /> {data.className}
                </Link>
                <h1 className="mt-1 text-2xl font-black text-ink-main">
                    {t("title")}
                </h1>
                <p className="text-sm text-ink-soft">
                    {formatKabulLongDate(data.startTime, locale)}{" "}
                    •{" "}
                    {formatKabulTime(data.startTime, locale)}{" "}
                    –{" "}
                    {formatKabulTime(data.endTime, locale)}
                </p>
                <p className="mt-2 text-sm font-semibold text-neon-700">
                    {t("verifiedJoinedCount", {
                        verified: verifiedCount,
                        joined: presentCount,
                        total: data.students.length,
                    })}
                </p>
                <p className="mt-1 text-[11px] text-ink-faint">
                    ✓✓ {t("legend.verified")} · ✓ {t("legend.joinedOnly")} · ✗ {t("legend.absent")}
                </p>
            </header>

            {saveError ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
                    {saveError}
                </p>
            ) : null}

            {data.students.length === 0 ? (
                <div className="panel panel-strong p-6 text-center text-ink-soft">
                    {t("noStudents")}
                </div>
            ) : (
                <div className="panel panel-strong overflow-x-auto p-4">
                    <table className="w-full min-w-[560px] border-collapse text-start text-sm">
                        <thead>
                            <tr className="border-b border-line text-ink-soft">
                                <th className="py-2 font-semibold" scope="col">{t("student")}</th>
                                <th className="py-2 font-semibold" scope="col">{t("email")}</th>
                                <th className="py-2 text-center font-semibold" scope="col">{t("status")}</th>
                                <th className="py-2 text-center font-semibold" scope="col">{t("manual")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.students.map((student) => {
                                const state = student.checkinVerified
                                    ? "verified"
                                    : student.attended
                                        ? "joined"
                                        : "absent";
                                const glyph = state === "verified" ? "✓✓" : state === "joined" ? "✓" : "✗";
                                const glyphColor =
                                    state === "verified"
                                        ? "bg-neon-500/10 text-neon-400"
                                        : state === "joined"
                                            ? "bg-amber-500/10 text-amber-400"
                                            : "bg-red-500/10 text-red-400";
                                const detail =
                                    state === "verified"
                                        ? `${t("legend.verified")} · ${formatTime(student.checkinAt, locale) ?? ""}`
                                        : state === "joined"
                                            ? `${t("legend.joinedOnly")} · ${formatTime(student.joinedAt, locale) ?? ""}`
                                            : t("legend.absent");
                                return (
                                    <tr
                                        className="border-b border-line-soft text-ink-main"
                                        key={student.studentId}
                                    >
                                        <td className="py-2 font-semibold text-ink-main">
                                            {student.studentName}
                                        </td>
                                        <td className="py-2 text-ink-soft">{student.studentEmail}</td>
                                        <td className="py-2 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${glyphColor}`}>
                                                    {glyph}
                                                </span>
                                                <span className="text-xs text-ink-faint">{detail}</span>
                                            </div>
                                        </td>
                                        <td className="py-2 text-center">
                                            <button
                                                aria-label={student.attended ? t("markAbsent", { name: student.studentName }) : t("markPresent", { name: student.studentName })}
                                                className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${student.attended
                                                        ? "bg-neon-100 text-neon-700"
                                                        : "bg-dark-100 text-ink-faint hover:bg-red-50 hover:text-red-500"
                                                    }`}
                                                disabled={saving === student.studentId}
                                                onClick={() =>
                                                    toggleAttendance(student.studentId, !student.attended)
                                                }
                                                type="button"
                                            >
                                                {saving === student.studentId ? "…" : student.attended ? "✓" : "✗"}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export function ClassAttendanceSummary({
    classId,
    locale,
}: {
    classId: string;
    locale: string;
}) {
    const t = useTranslations("attendance");
    const tClasses = useTranslations("teacherClasses");
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchJsonOrNull<SummaryData>(`/api/classes/${classId}/attendance`)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [classId]);

    if (loading) {
        return (
            <div className="panel panel-strong p-6 text-center text-ink-soft">
                {t("summaryLoading")}
            </div>
        );
    }

    if (!data || data.totalStudents === 0) {
        return (
            <div className="panel panel-strong p-6 text-center text-ink-soft">
                {t("noAttendanceData")}
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <header className="hero-panel p-5">
                <Link
                    className="text-sm font-semibold text-indigo-600 hover:underline"
                    href={`/${locale}/teacher/classes`}
                >
                    {/* Was "Staff Dashboard", an admin-only page that bounced teachers. */}
                    <DirArrow back /> {tClasses("title")}
                </Link>
                <h1 className="mt-1 text-2xl font-black text-ink-main">
                    {t("summaryTitle")}
                </h1>
                <p className="text-sm text-ink-soft">
                    {t("summaryStats", { students: data.totalStudents, sessions: data.totalSessions })}
                </p>
            </header>

            <div className="panel panel-strong overflow-x-auto p-4">
                <table className="w-full min-w-[480px] border-collapse text-start text-sm">
                    <thead>
                        <tr className="border-b border-line text-ink-soft">
                            <th className="py-2 font-semibold" scope="col">{t("student")}</th>
                            <th className="py-2 font-semibold" scope="col">{t("email")}</th>
                            <th className="py-2 text-center font-semibold" scope="col">{t("joinedColumn")}</th>
                            <th className="py-2 text-center font-semibold" scope="col">{t("joinRate")}</th>
                            <th className="py-2 text-center font-semibold" scope="col">{t("verifiedColumn")}</th>
                            <th className="py-2 text-center font-semibold" scope="col">{t("verifyRate")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.students.map((s) => {
                            const verifyRate = s.verificationRate ?? 0;
                            const verifyPill =
                                verifyRate >= 80
                                    ? "bg-neon-100 text-neon-700"
                                    : verifyRate >= 50
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-red-100 text-red-700";
                            return (
                                <tr
                                    className="border-b border-line-soft text-ink-main"
                                    key={s.studentId}
                                >
                                    <td className="py-2 font-semibold text-ink-main">
                                        {s.studentName}
                                    </td>
                                    <td className="py-2 text-ink-soft">{s.studentEmail}</td>
                                    <td className="py-2 text-center">
                                        {s.sessionsAttended} / {s.totalSessions}
                                    </td>
                                    <td className="py-2 text-center">
                                        <span
                                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${s.attendanceRate >= 80
                                                    ? "bg-neon-100 text-neon-700"
                                                    : s.attendanceRate >= 50
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-red-100 text-red-700"
                                                }`}
                                        >
                                            {s.attendanceRate}%
                                        </span>
                                    </td>
                                    <td className="py-2 text-center">
                                        {s.sessionsVerified ?? 0} / {s.totalSessions}
                                    </td>
                                    <td className="py-2 text-center">
                                        <span
                                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${verifyPill}`}
                                        >
                                            {verifyRate}%
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
