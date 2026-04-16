"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { HomeworkSubmit } from "./homework-submit";
import { NoteEditor } from "./note-editor";
import { PostClassQuiz } from "./post-class-quiz";
import { QuickAi } from "./quick-ai";
import { VocabularyTracker } from "./vocabulary-tracker";

type LiveData = {
  role: "student" | "teacher" | "admin";
  session: {
    id: string;
    classId: string;
    className: string;
    teacherName: string;
    startTime: string;
    endTime: string;
    meetLink: string | null;
    isLanguageClass: boolean;
  };
  materials: { id: string; title: string; fileUrl: string }[];
  attendance: { joinedAt: string | null } | null;
  notes: { content: string; updatedAt: string } | null;
  summary: { content: string; quizData: string | null; generatedAt: string } | null;
  homework: Array<{
    id: string;
    title: string;
    description: string;
    dueDate: string | null;
    submissions: Array<{
      id: string;
      content: string | null;
      fileUrl: string | null;
      imageUrl: string | null;
      aiReview: string | null;
      teacherGrade: string | null;
      teacherNotes: string | null;
      submittedAt: string;
    }>;
  }>;
  attendanceRoster: Array<{
    studentId: string;
    studentName: string;
    attended: boolean;
    joinedAt: string | null;
  }> | null;
};

interface CompanionPanelProps {
  initialData: LiveData;
  locale: "en" | "fa";
}

export function CompanionPanel({ initialData, locale }: CompanionPanelProps) {
  const [data, setData] = useState<LiveData>(initialData);
  const [joinedMeet, setJoinedMeet] = useState(Boolean(initialData.attendance?.joinedAt));
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { session, role } = data;

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/classes/${session.classId}/sessions/${session.id}/live`,
      );
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
      }
    } catch {
      /* ignore */
    }
  }, [session.classId, session.id]);

  // Auto-refresh roster (teacher view) every 20s
  useEffect(() => {
    if (role !== "teacher" && role !== "admin") return;
    const interval = setInterval(refreshData, 20_000);
    return () => clearInterval(interval);
  }, [role, refreshData]);

  const handleJoinMeet = useCallback(async () => {
    setJoinedMeet(true);
    if (role === "student") {
      try {
        await fetch(`/api/classes/${session.classId}/sessions/${session.id}/attend`, {
          method: "POST",
        });
      } catch {
        // silent — don't block join
      }
    }
  }, [role, session.classId, session.id]);

  const handleGenerateSummary = useCallback(async () => {
    setGeneratingSummary(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/classes/${session.classId}/sessions/${session.id}/summary`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Summary generation failed");
      }
      await refreshData();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setGeneratingSummary(false);
    }
  }, [session.classId, session.id, refreshData]);

  const handleGenerateQuiz = useCallback(async () => {
    setGeneratingQuiz(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/classes/${session.classId}/sessions/${session.id}/quiz`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Quiz generation failed");
      }
      await refreshData();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setGeneratingQuiz(false);
    }
  }, [session.classId, session.id, refreshData]);

  const sessionStart = new Date(session.startTime);
  const sessionEnd = new Date(session.endTime);
  const now = new Date();
  const isLive = now >= new Date(sessionStart.getTime() - 15 * 60 * 1000) && now <= sessionEnd;
  const isAfter = now > sessionEnd;
  const minsAgo = Math.floor((now.getTime() - sessionStart.getTime()) / 60_000);
  const minsUntil = Math.floor((sessionStart.getTime() - now.getTime()) / 60_000);

  let liveStatus: string;
  if (now < sessionStart) {
    liveStatus = `Starts in ${minsUntil} min`;
  } else if (isLive) {
    liveStatus = minsAgo > 0 ? `Started ${minsAgo} min ago` : "Starting now";
  } else {
    liveStatus = "Session ended";
  }

  let parsedQuiz: { questions: never[] } | null = null;
  if (data.summary?.quizData) {
    try {
      parsedQuiz = JSON.parse(data.summary.quizData);
    } catch {
      parsedQuiz = null;
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* LEFT: Meet pane (60%) */}
      <div className="lg:col-span-3 space-y-4">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-neon-600 to-teal-700 text-white p-6">
          <p className="text-neon-100 text-xs font-semibold uppercase tracking-wide">
            {data.session.isLanguageClass ? "Language Class" : "Live Session"}
          </p>
          <h1 className="text-2xl font-bold mt-1">{session.className}</h1>
          <p className="text-neon-100 text-sm mt-1">With {session.teacherName}</p>
          <p className="text-neon-200 text-xs mt-3">⏰ {liveStatus}</p>
        </div>

        {/* Join Meet button */}
        <div className="rounded-2xl bg-dark-100 border border-line-DEFAULT p-8 text-center">
          {session.meetLink ? (
            <>
              {!joinedMeet ? (
                <a
                  href={session.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleJoinMeet}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-neon-600 text-white text-lg font-bold hover:bg-neon-700 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Join Google Meet
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              ) : (
                <div>
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neon-50 text-neon-700 font-semibold mb-3">
                    <span className="w-2 h-2 rounded-full bg-neon-500 animate-pulse" />
                    Connected — Meet is open in another tab
                  </div>
                  <p className="text-sm text-ink-soft">
                    Switch back to the Meet tab anytime. Your notes save here.
                  </p>
                  <a
                    href={session.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 text-sm text-neon-600 hover:text-neon-700 font-medium"
                  >
                    Re-open Meet ↗
                  </a>
                </div>
              )}
            </>
          ) : (
            <p className="text-ink-soft">
              Meet link not available yet. Check back closer to start time.
            </p>
          )}
        </div>

        {/* Materials */}
        {data.materials.length > 0 && (
          <div className="rounded-2xl bg-dark-100 border border-line-DEFAULT p-5">
            <h3 className="text-sm font-bold text-ink-main mb-3">📚 Today&apos;s materials</h3>
            <ul className="space-y-2">
              {data.materials.map((m) => (
                <li key={m.id}>
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-ink-main hover:text-neon-700"
                  >
                    <svg className="w-4 h-4 text-ink-faint flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span className="truncate">{m.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Teacher tools */}
        {(role === "teacher" || role === "admin") && isAfter && (
          <div className="rounded-2xl bg-dark-100 border border-line-DEFAULT p-5">
            <h3 className="text-sm font-bold text-ink-main mb-3">After class — teacher tools</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-600 text-white text-sm font-semibold hover:bg-neon-700 disabled:opacity-50"
              >
                {generatingSummary ? "Generating..." : data.summary ? "📝 Regenerate summary" : "📝 Generate summary"}
              </button>
              {data.summary && (
                <button
                  type="button"
                  onClick={handleGenerateQuiz}
                  disabled={generatingQuiz}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {generatingQuiz ? "Generating..." : parsedQuiz ? "📋 Regenerate quiz" : "📋 Create quiz"}
                </button>
              )}
              <Link
                href={`/${locale}/classes/${session.classId}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-line-DEFAULT text-sm font-medium text-ink-main hover:bg-dark-50"
              >
                Recording & homework setup →
              </Link>
            </div>
            {actionError && <p className="text-xs text-red-600 mt-2">{actionError}</p>}
          </div>
        )}

        {/* Teacher attendance roster */}
        {data.attendanceRoster && (
          <div className="rounded-2xl bg-dark-100 border border-line-DEFAULT p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-ink-main">Attendance</h3>
              <span className="text-xs text-ink-soft">
                {data.attendanceRoster.filter((a) => a.attended).length} / {data.attendanceRoster.length} joined
              </span>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {data.attendanceRoster.map((a) => (
                <div
                  key={a.studentId}
                  className="flex items-center justify-between py-1.5 px-2 rounded text-sm"
                >
                  <span className="flex items-center gap-2">
                    {a.attended ? (
                      <span className="text-neon-500">✓</span>
                    ) : (
                      <span className="text-ink-faint">○</span>
                    )}
                    <span className={a.attended ? "text-ink-main" : "text-ink-faint"}>
                      {a.studentName}
                    </span>
                  </span>
                  {a.joinedAt && (
                    <span className="text-xs text-ink-faint">
                      {new Date(a.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI summary (visible to all after generation) */}
        {data.summary && (
          <div className="rounded-2xl bg-dark-100 border border-line-DEFAULT p-5">
            <h3 className="text-sm font-bold text-ink-main mb-3">📝 Class summary</h3>
            <div
              className="text-sm text-ink-main whitespace-pre-wrap leading-relaxed"
              dir={locale === "fa" ? "rtl" : "ltr"}
            >
              {data.summary.content}
            </div>
          </div>
        )}

        {/* Quiz (after summary) */}
        {parsedQuiz && parsedQuiz.questions && (
          <PostClassQuiz questions={parsedQuiz.questions} />
        )}

        {/* Homework */}
        {data.homework.map((hw) => (
          <HomeworkSubmit
            key={hw.id}
            classId={session.classId}
            sessionId={session.id}
            assignment={hw}
            onSubmitted={refreshData}
          />
        ))}
      </div>

      {/* RIGHT: Companion panel (40%) */}
      <div className="lg:col-span-2 space-y-4">
        {role === "student" && (
          <>
            {/* Notes */}
            <div className="rounded-2xl bg-dark-100 border border-line-DEFAULT p-5">
              <h3 className="text-sm font-bold text-ink-main mb-3">📝 My notes</h3>
              <NoteEditor
                classId={session.classId}
                sessionId={session.id}
                initialContent={data.notes?.content ?? ""}
                initialUpdatedAt={data.notes?.updatedAt ?? null}
              />
            </div>

            {/* Quick AI */}
            {(isLive || isAfter) && (
              <div className="rounded-2xl bg-gradient-to-br from-neon-50 via-white to-sky-50 border border-neon-100 p-5">
                <h3 className="text-sm font-bold text-ink-main mb-3">💬 Quick AI</h3>
                <QuickAi classId={session.classId} locale={locale} />
              </div>
            )}

            {/* Vocabulary (language classes) */}
            {data.session.isLanguageClass && (
              <div className="rounded-2xl bg-dark-100 border border-line-DEFAULT p-5">
                <h3 className="text-sm font-bold text-ink-main mb-3">📖 Key vocabulary</h3>
                <VocabularyTracker
                  initialWords={extractVocabFromMaterials(data.materials, data.summary?.content)}
                  locale={locale}
                  classId={session.classId}
                />
              </div>
            )}
          </>
        )}

        {/* Status bar at top of right column */}
        {role === "student" && joinedMeet && data.attendance?.joinedAt && (
          <div className="rounded-2xl bg-neon-50 border border-neon-200 p-4">
            <p className="text-xs font-semibold text-neon-700">
              ✓ Attendance marked at{" "}
              {new Date(data.attendance.joinedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Naive vocabulary extractor — pulls common bolded/quoted words from materials titles
 * or summary content. The AI vocabulary mode does the real extraction.
 */
function extractVocabFromMaterials(
  materials: { title: string }[],
  summary: string | undefined,
): { word: string; meaning?: string }[] {
  const words = new Set<string>();
  const text = summary || "";

  // From summary: extract bolded **terms**
  const boldMatches = Array.from(text.matchAll(/\*\*([^*\n]{3,40})\*\*/g));
  for (const match of boldMatches) {
    words.add(match[1].trim());
  }

  // From summary: pick lines that look like vocabulary entries (e.g. "- term: definition")
  const result: { word: string; meaning?: string }[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^[-•*]\s+([A-Za-z][A-Za-z\s-]{2,30}):\s*(.+)$/);
    if (m && result.length < 12) {
      result.push({ word: m[1].trim(), meaning: m[2].trim().substring(0, 80) });
    }
  }

  // Fallback: bolded words without definitions
  if (result.length === 0) {
    for (const w of Array.from(words).slice(0, 8)) {
      result.push({ word: w });
    }
  }

  // Fallback: material titles
  if (result.length === 0) {
    for (const m of materials.slice(0, 5)) {
      result.push({ word: m.title });
    }
  }

  return result.slice(0, 12);
}
