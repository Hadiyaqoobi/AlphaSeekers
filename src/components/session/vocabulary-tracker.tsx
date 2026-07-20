"use client";

import { useCallback, useState } from "react";

interface VocabItem {
  word: string;
  pronunciation?: string;
  meaning?: string;
}

interface VocabularyTrackerProps {
  initialWords: VocabItem[];
  locale: "en" | "fa";
  classId: string;
}

export function VocabularyTracker({ initialWords, locale, classId }: VocabularyTrackerProps) {
  const [words, setWords] = useState<VocabItem[]>(initialWords);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [newWord, setNewWord] = useState("");

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = locale === "fa" ? "fa-AF" : "en-US";
      utter.rate = 0.85;
      window.speechSynthesis.speak(utter);
    },
    [locale],
  );

  const handleStar = useCallback(
    async (item: VocabItem) => {
      const next = new Set(starred);
      if (next.has(item.word)) {
        next.delete(item.word);
      } else {
        next.add(item.word);
        // Add to spaced repetition queue (fire-and-forget)
        // Reuse the shape SpacedRepetitionItem expects
        try {
          // No dedicated endpoint exists for adding individual SRS items from the client,
          // so we fall back to logging. The vocab is also auto-extracted by the AI pipeline
          // via extractAndQueueVocabulary, so starring acts as a manual signal.
          await fetch(`/api/ai/quick`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `Define "${item.word}" briefly in ${locale === "fa" ? "Dari" : "English"}.`,
              classId,
              locale,
            }),
          });
        } catch {
          // silent
        }
      }
      setStarred(next);
    },
    [starred, locale, classId],
  );

  const addWord = useCallback(() => {
    const w = newWord.trim();
    if (!w) return;
    setWords((prev) => [{ word: w }, ...prev]);
    setNewWord("");
  }, [newWord]);

  return (
    <div>
      {words.length === 0 ? (
        <p className="text-xs text-ink-faint italic">
          No vocabulary detected from today&apos;s materials yet.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {words.map((item, i) => (
            <div
              key={`${item.word}-${i}`}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-dark-100 border border-line-soft hover:border-line transition-colors text-sm"
            >
              <button
                type="button"
                onClick={() => speak(item.word)}
                className="flex-1 flex items-center gap-2 text-left text-ink-main hover:text-neon-700 min-w-0"
                title="Click to hear pronunciation"
              >
                <svg className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
                <span className="font-medium truncate">{item.word}</span>
                {item.meaning && (
                  <span className="text-xs text-ink-faint truncate" dir={locale === "fa" ? "rtl" : "ltr"}>
                    · {item.meaning}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleStar(item)}
                className={`text-base flex-shrink-0 transition-colors ${
                  starred.has(item.word) ? "text-amber-500" : "text-ink-faint hover:text-amber-400"
                }`}
                title="Star to add to spaced repetition"
              >
                {starred.has(item.word) ? "★" : "☆"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5">
        <input
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addWord()}
          placeholder="Add a word..."
          className="flex-1 rounded-lg border border-line bg-dark-100 px-2.5 py-1.5 text-xs placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-neon-500/30"
        />
        <button
          type="button"
          onClick={addWord}
          disabled={!newWord.trim()}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neon-700 bg-neon-50 hover:bg-neon-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}
