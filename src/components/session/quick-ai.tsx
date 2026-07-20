"use client";

import { useCallback, useState } from "react";

interface QuickAiProps {
  classId: string;
  locale: "en" | "fa";
}

type QuickEntry = {
  id: string;
  query: string;
  answer: string;
  loading: boolean;
};

export function QuickAi({ classId, locale }: QuickAiProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<QuickEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAsk = useCallback(async () => {
    const query = input.trim();
    if (!query || submitting) return;

    const id = crypto.randomUUID();
    const entry: QuickEntry = { id, query, answer: "", loading: true };
    setHistory((prev) => [entry, ...prev].slice(0, 10));
    setInput("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/ai/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, classId, locale }),
      });

      if (!res.ok) throw new Error(`AI request failed (${res.status})`);
      const data = await res.json();

      setHistory((prev) =>
        prev.map((h) => (h.id === id ? { ...h, answer: data.answer, loading: false } : h)),
      );
    } catch {
      setHistory((prev) =>
        prev.map((h) =>
          h.id === id
            ? { ...h, answer: "Couldn't get an answer. Try again.", loading: false }
            : h,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, [input, submitting, classId, locale]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask quietly..."
          disabled={submitting}
          className="w-full rounded-lg border border-line bg-dark-100 px-3 py-2 pr-10 text-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-neon-500/30 focus:border-neon-400"
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={!input.trim() || submitting}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-neon-600 text-white disabled:opacity-30 hover:bg-neon-700 flex items-center justify-center"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12 7.5-7.5 7.5 7.5M12 4.5v15" />
          </svg>
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
          {history.map((entry) => (
            <div key={entry.id} className="rounded-lg bg-dark-50 border border-line-soft p-3 text-xs">
              <p className="font-medium text-ink-main mb-1">{entry.query}</p>
              {entry.loading ? (
                <p className="text-ink-faint italic">Thinking...</p>
              ) : (
                <p className="text-ink-soft leading-relaxed whitespace-pre-wrap">{entry.answer}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] text-ink-faint text-center">Quick answers · longer questions in the AI Tutor</p>
    </div>
  );
}
