"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Link from "next/link";

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

function formatTime(iso: string | null | undefined): string | null {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

    useEffect(() => {
        fetch(`/api/classes/sessions/${sessionId}/attendance`)
            .then((r) => r.json())
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [sessionId]);

    async function toggleAttendance(studentId: string, attended: boolean) {
        setSaving(studentId);
        try {
            await fetch(`/api/classes/sessions/${sessionId}/attendance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId, attended }),
            });
            setData((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    students: prev.students.map((s) =>
                        s.studentId === studentId
                            ? { ...s, attended, joinedAt: attended ? new Date().toISOString() : null }
                            : s,
                    ),
                };
            });
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
                Session not found.
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
                    ← {data.className}
                </Link>
                <h1 className="mt-1 text-2xl font-black text-ink-main">
                    Session Attendance
                </h1>
                <p className="text-sm text-ink-soft">
                    {new Date(data.startTime).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                    })}{" "}
                    •{" "}
                    {new Date(data.startTime).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}{" "}
                    –{" "}
                    {new Date(data.endTime).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </p>
                <p className="mt-2 text-sm font-semibold text-neon-700">
                    {verifiedCount} verified · {presentCount} / {data.students.length} joined
                </p>
                <p className="mt-1 text-[11px] text-ink-faint">
                    ✓✓ {t("legend.verified")} · ✓ {t("legend.joinedOnly")} · ✗ {t("legend.absent")}
                </p>
            </header>

            {data.students.length === 0 ? (
                <div className="panel panel-strong p-6 text-center text-ink-soft">
                    No students enrolled in this class.
                </div>
            ) : (
                <div className="panel panel-strong overflow-x-auto p-4">
                    <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-line-DEFAULT text-ink-soft">
                                <th className="py-2 font-semibold" scope="col">Student</th>
                                <th className="py-2 font-semibold" scope="col">Email</th>
                                <th className="py-2 text-center font-semibold" scope="col">Status</th>
                                <th className="py-2 text-center font-semibold" scope="col">Manual</th>
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
                                        ? `${t("legend.verified")} · ${formatTime(student.checkinAt) ?? ""}`
                                        : state === "joined"
                                            ? `${t("legend.joinedOnly")} · ${formatTime(student.joinedAt) ?? ""}`
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
                                                aria-label={student.attended ? `Mark ${student.studentName} as absent` : `Mark ${student.studentName} as present`}
                                                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${student.attended
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
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/classes/${classId}/attendance`)
            .then((r) => r.json())
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
                No attendance data yet.
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <header className="hero-panel p-5">
                <Link
                    className="text-sm font-semibold text-indigo-600 hover:underline"
                    href={`/${locale}/staff/dashboard`}
                >
                    ← Staff Dashboard
                </Link>
                <h1 className="mt-1 text-2xl font-black text-ink-main">
                    Attendance Summary
                </h1>
                <p className="text-sm text-ink-soft">
                    {data.totalStudents} students • {data.totalSessions} sessions
                </p>
            </header>

            <div className="panel panel-strong overflow-x-auto p-4">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-line-DEFAULT text-ink-soft">
                            <th className="py-2 font-semibold" scope="col">Student</th>
                            <th className="py-2 font-semibold" scope="col">Email</th>
                            <th className="py-2 text-center font-semibold" scope="col">Joined</th>
                            <th className="py-2 text-center font-semibold" scope="col">Join rate</th>
                            <th className="py-2 text-center font-semibold" scope="col">Verified</th>
                            <th className="py-2 text-center font-semibold" scope="col">Verify rate</th>
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
