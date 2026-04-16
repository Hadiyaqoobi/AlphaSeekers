"use client";

import { useState } from "react";

interface LessonChatProps {
  pathId: string;
  lessonNumber: number;
  isDari: boolean;
}

type Entry = {
  id: string;
  query: string;
  answer: string;
  loading: boolean;
};

export function LessonChat({ pathId, lessonNumber, isDari }: LessonChatProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function ask() {
    const query = input.trim();
    if (!query || submitting) return;
    const id = crypto.randomUUID();
    setHistory((h) => [{ id, query, answer: "", loading: true }, ...h].slice(0, 8));
    setInput("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/learn/lesson/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId, lessonNumber, query }),
      });
      const data = await res.json();
      const answer =
        data.answer ||
        data.message ||
        "I couldn't answer that — try asking a different way.";
      setHistory((h) => h.map((e) => (e.id === id ? { ...e, answer, loading: false } : e)));
    } catch {
      setHistory((h) =>
        h.map((e) =>
          e.id === id ? { ...e, answer: "Network error. Try again.", loading: false } : e,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
    >
      <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8899A6" }}>
        💬 {isDari ? "سوالی درباره این درس دارید؟" : "Have questions about this lesson?"}
      </h4>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={submitting}
          placeholder={isDari ? "نمی‌فهمم..." : "I don't understand..."}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
          style={{ background: "#142230", border: "1px solid #1E3A4F", color: "#E8EEF2" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#00E676"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#1E3A4F"; }}
        />
        <button
          type="button"
          onClick={ask}
          disabled={!input.trim() || submitting}
          className="px-3 py-2.5 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#00E676", color: "#080D12" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
          {history.map((entry) => (
            <div key={entry.id} className="space-y-1.5">
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "rgba(0,230,118,0.08)", color: "#00E676" }}
              >
                {entry.query}
              </div>
              <div
                className="rounded-lg px-3 py-2 text-sm leading-relaxed"
                style={{ background: "#142230", color: "#C0CCD6", border: "1px solid #1A2D3D" }}
              >
                {entry.loading ? (
                  <span style={{ color: "#556677" }} className="italic">Thinking...</span>
                ) : (
                  entry.answer
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
