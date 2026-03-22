"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Student = {
    studentId: string;
    studentName: string;
    studentEmail: string;
    attended: boolean;
    joinedAt: string | null;
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
    totalSessions: number;
    attendanceRate: number;
};

type SummaryData = {
    classId: string;
    totalSessions: number;
    totalStudents: number;
    students: SummaryStudent[];
};

export function AttendanceSheet({
    sessionId,
    locale,
}: {
    sessionId: string;
    locale: string;
}) {
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
            <div className="panel panel-strong p-6 text-center text-slate-500">
                Loading attendance...
            </div>
        );
    }

    if (!data) {
        return (
            <div className="panel panel-strong p-6 text-center text-slate-500">
                Session not found.
            </div>
        );
    }

    const presentCount = data.students.filter((s) => s.attended).length;

    return (
        <section className="space-y-4">
            <header className="hero-panel p-5">
                <Link
                    className="text-sm font-semibold text-indigo-600 hover:underline"
                    href={`/${locale}/classes/${data.classId}`}
                >
                    ← {data.className}
                </Link>
                <h1 className="mt-1 text-2xl font-black text-slate-900">
                    Session Attendance
                </h1>
                <p className="text-sm text-slate-600">
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
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                    {presentCount} / {data.students.length} present
                </p>
            </header>

            {data.students.length === 0 ? (
                <div className="panel panel-strong p-6 text-center text-slate-500">
                    No students enrolled in this class.
                </div>
            ) : (
                <div className="panel panel-strong overflow-x-auto p-4">
                    <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-2 font-semibold" scope="col">Student</th>
                                <th className="py-2 font-semibold" scope="col">Email</th>
                                <th className="py-2 text-center font-semibold" scope="col">Present</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.students.map((student) => (
                                <tr
                                    className="border-b border-slate-100 text-slate-700"
                                    key={student.studentId}
                                >
                                    <td className="py-2 font-semibold text-slate-900">
                                        {student.studentName}
                                    </td>
                                    <td className="py-2 text-slate-500">{student.studentEmail}</td>
                                    <td className="py-2 text-center">
                                        <button
                                            aria-label={student.attended ? `Mark ${student.studentName} as absent` : `Mark ${student.studentName} as present`}
                                            className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold transition-colors ${student.attended
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500"
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
                            ))}
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
            <div className="panel panel-strong p-6 text-center text-slate-500">
                Loading summary...
            </div>
        );
    }

    if (!data || data.totalStudents === 0) {
        return (
            <div className="panel panel-strong p-6 text-center text-slate-500">
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
                <h1 className="mt-1 text-2xl font-black text-slate-900">
                    Attendance Summary
                </h1>
                <p className="text-sm text-slate-600">
                    {data.totalStudents} students • {data.totalSessions} sessions
                </p>
            </header>

            <div className="panel panel-strong overflow-x-auto p-4">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 font-semibold" scope="col">Student</th>
                            <th className="py-2 font-semibold" scope="col">Email</th>
                            <th className="py-2 text-center font-semibold" scope="col">Attended</th>
                            <th className="py-2 text-center font-semibold" scope="col">Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.students.map((s) => (
                            <tr
                                className="border-b border-slate-100 text-slate-700"
                                key={s.studentId}
                            >
                                <td className="py-2 font-semibold text-slate-900">
                                    {s.studentName}
                                </td>
                                <td className="py-2 text-slate-500">{s.studentEmail}</td>
                                <td className="py-2 text-center">
                                    {s.sessionsAttended} / {s.totalSessions}
                                </td>
                                <td className="py-2 text-center">
                                    <span
                                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${s.attendanceRate >= 80
                                                ? "bg-emerald-100 text-emerald-700"
                                                : s.attendanceRate >= 50
                                                    ? "bg-amber-100 text-amber-700"
                                                    : "bg-red-100 text-red-700"
                                            }`}
                                    >
                                        {s.attendanceRate}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
