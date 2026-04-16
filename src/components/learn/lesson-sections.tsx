"use client";

import { useState } from "react";

// ── Section type definitions ──
type ExplanationSection = { type: "explanation"; title: string; content: string };
type ExampleSection = { type: "example"; title: string; content: string; code?: string };
type KeyPointSection = { type: "key_point"; title: string; points: string[] };
type TryItSection = { type: "try_it"; title: string; prompt: string; hint?: string };
type VocabSection = {
  type: "vocabulary";
  title: string;
  words: { term: string; definition: string; dari?: string; example?: string }[];
};
type QuizSection = {
  type: "quiz";
  title: string;
  questions: { question: string; options: string[]; correct: number; explanation: string }[];
};
type SummarySection = {
  type: "summary";
  title: string;
  content: string;
  nextPreview?: string;
};

export type LessonSection =
  | ExplanationSection
  | ExampleSection
  | KeyPointSection
  | TryItSection
  | VocabSection
  | QuizSection
  | SummarySection;

// ── Per-type renderers ──

function Explanation({ section }: { section: ExplanationSection }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📖</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00E676" }}>
          {section.title || "Explanation"}
        </h3>
      </div>
      <div className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: "#C0CCD6" }}>
        {section.content}
      </div>
    </div>
  );
}

function Example({ section }: { section: ExampleSection }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#0E1921", border: "1px solid rgba(0,229,255,0.18)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">💡</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00E5FF" }}>
          {section.title || "Example"}
        </h3>
      </div>
      {section.code && (
        <pre
          className="rounded-xl p-4 text-sm font-mono overflow-x-auto mb-3"
          style={{
            background: "#080D12",
            color: "#B0BEC5",
            border: "1px solid #1A2D3D",
          }}
        >
          <code>{section.code}</code>
        </pre>
      )}
      <p className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: "#C0CCD6" }}>
        {section.content}
      </p>
    </div>
  );
}

function KeyPoint({ section }: { section: KeyPointSection }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📌</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#FFB300" }}>
          {section.title || "Remember this"}
        </h3>
      </div>
      <ul className="space-y-2.5">
        {section.points.map((point, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px]" style={{ color: "#E8EEF2" }}>
            <span style={{ color: "#00E676", marginTop: 1 }}>✓</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TryIt({
  section,
  pathId,
  lessonNumber,
}: {
  section: TryItSection;
  pathId: string;
  lessonNumber: number;
}) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);

  async function checkAnswer() {
    if (!answer.trim() || loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/learn/lesson/check-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathId,
          lessonNumber,
          prompt: section.prompt,
          answer,
        }),
      });
      const data = await res.json();
      setFeedback({ correct: data.correct, feedback: data.feedback });
    } catch {
      setFeedback({ correct: false, feedback: "Couldn't reach the AI. Try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: "#142230", border: "1px solid rgba(0,230,118,0.18)" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">✏️</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00E676" }}>
          {section.title || "Your turn"}
        </h3>
      </div>
      <p className="text-[15px] mb-4" style={{ color: "#E8EEF2" }}>{section.prompt}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer..."
        rows={3}
        className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none transition-colors"
        style={{ background: "#0E1921", border: "1px solid #1E3A4F", color: "#E8EEF2" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#00E676"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#1E3A4F"; }}
      />
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button
          type="button"
          onClick={checkAnswer}
          disabled={!answer.trim() || loading}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#00E676", color: "#080D12" }}
        >
          {loading ? "Checking..." : "Check my answer"}
        </button>
        {section.hint && (
          <button
            type="button"
            onClick={() => setShowHint((s) => !s)}
            className="text-xs transition-colors"
            style={{ color: "#8899A6" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#00E676"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#8899A6"; }}
          >
            💡 {showHint ? "Hide hint" : "Need a hint?"}
          </button>
        )}
      </div>
      {showHint && section.hint && (
        <div
          className="mt-3 p-3 rounded-lg text-sm"
          style={{ background: "rgba(255,179,0,0.08)", color: "#FFCA28" }}
        >
          💡 {section.hint}
        </div>
      )}
      {feedback && (
        <div
          className="mt-4 p-4 rounded-xl text-sm leading-relaxed"
          style={{
            background: feedback.correct
              ? "rgba(0,230,118,0.08)"
              : "rgba(255,179,0,0.08)",
            border: `1px solid ${feedback.correct ? "rgba(0,230,118,0.25)" : "rgba(255,179,0,0.25)"}`,
            color: feedback.correct ? "#00E676" : "#FFCA28",
          }}
        >
          <span className="font-bold mr-1">{feedback.correct ? "✓" : "💭"}</span>
          {feedback.feedback}
        </div>
      )}
    </div>
  );
}

function Vocabulary({ section }: { section: VocabSection }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📝</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#2979FF" }}>
          {section.title || "New words"}
        </h3>
      </div>
      <div className="space-y-3">
        {section.words.map((w, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 py-3"
            style={{ borderBottom: i < section.words.length - 1 ? "1px solid #142230" : "none" }}
          >
            <span className="text-sm font-semibold sm:w-32" style={{ color: "#E8EEF2" }}>
              {w.term}
            </span>
            {w.dari && (
              <span
                className="text-sm sm:w-28"
                style={{ color: "#00E5FF", fontFamily: "var(--font-arabic, sans-serif)" }}
                dir="rtl"
              >
                {w.dari}
              </span>
            )}
            <span className="text-sm flex-1" style={{ color: "#8899A6" }}>
              {w.definition}
              {w.example && (
                <span className="block mt-1 italic text-xs" style={{ color: "#556677" }}>
                  &ldquo;{w.example}&rdquo;
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Quiz({
  section,
  onComplete,
}: {
  section: QuizSection;
  onComplete: (score: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const q = section.questions[index];
  const isCorrect = selected === q?.correct;

  if (done) {
    const total = section.questions.length;
    const score = correctCount / total;
    return (
      <div className="rounded-2xl p-6" style={{ background: "#0E1921", border: "1px solid rgba(0,230,118,0.25)" }}>
        <div className="text-center">
          <div className="text-3xl mb-2">{score === 1 ? "🎉" : score >= 0.6 ? "👍" : "💪"}</div>
          <p className="text-base font-semibold mb-1" style={{ color: "#E8EEF2" }}>
            {correctCount} / {total} correct
          </p>
          <p className="text-sm" style={{ color: "#8899A6" }}>
            {score === 1
              ? "Perfect — you really got it!"
              : score >= 0.6
                ? "Good progress. Re-read the explanation if you missed any."
                : "Don't worry — these are tough. Try the lesson again or move on."}
          </p>
        </div>
      </div>
    );
  }

  if (!q) return null;

  function next() {
    if (revealed) {
      // move on
      if (isCorrect) setCorrectCount((c) => c + 1);
      const newIndex = index + 1;
      if (newIndex >= section.questions.length) {
        const finalCorrect = correctCount + (isCorrect ? 1 : 0);
        setDone(true);
        onComplete(finalCorrect / section.questions.length);
      } else {
        setIndex(newIndex);
        setSelected(null);
        setRevealed(false);
      }
    } else {
      setRevealed(true);
    }
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">✅</span>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00E676" }}>
            {section.title || "Quick check"}
          </h3>
        </div>
        <span className="text-xs" style={{ color: "#556677" }}>
          {index + 1} / {section.questions.length}
        </span>
      </div>

      <p className="text-base font-medium mb-4" style={{ color: "#E8EEF2" }}>
        {q.question}
      </p>

      <div className="space-y-2 mb-4">
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const isAnswer = i === q.correct;
          const showCorrect = revealed && isAnswer;
          const showWrong = revealed && isSelected && !isAnswer;
          return (
            <button
              key={i}
              type="button"
              onClick={() => !revealed && setSelected(i)}
              disabled={revealed}
              className="w-full text-left px-4 py-3 rounded-lg text-sm transition-colors"
              style={{
                background: showCorrect
                  ? "rgba(0,230,118,0.10)"
                  : showWrong
                    ? "rgba(239,68,68,0.10)"
                    : isSelected
                      ? "rgba(0,230,118,0.06)"
                      : "#142230",
                border: `1px solid ${
                  showCorrect
                    ? "#00E676"
                    : showWrong
                      ? "#EF4444"
                      : isSelected
                        ? "rgba(0,230,118,0.30)"
                        : "#1A2D3D"
                }`,
                color: showCorrect
                  ? "#00E676"
                  : showWrong
                    ? "#F87171"
                    : "#E8EEF2",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div
          className="p-3 rounded-lg text-sm mb-4"
          style={{
            background: "rgba(0,229,255,0.06)",
            border: "1px solid rgba(0,229,255,0.20)",
            color: "#C0CCD6",
          }}
        >
          {q.explanation}
        </div>
      )}

      <button
        type="button"
        onClick={next}
        disabled={!revealed && selected === null}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: revealed ? "#080D12" : "#00E676",
          color: revealed ? "#FFFFFF" : "#080D12",
          border: revealed ? "1px solid #1A2D3D" : "none",
        }}
      >
        {revealed
          ? index + 1 >= section.questions.length
            ? "See results →"
            : "Next question →"
          : "Submit answer"}
      </button>
    </div>
  );
}

function Summary({
  section,
  onComplete,
  isLast,
  nextHref,
}: {
  section: SummarySection;
  onComplete: () => void;
  isLast: boolean;
  nextHref: string;
}) {
  const [marking, setMarking] = useState(false);

  async function handleNext() {
    setMarking(true);
    onComplete();
  }

  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: "linear-gradient(180deg, rgba(0,230,118,0.08), transparent)",
        border: "1px solid rgba(0,230,118,0.25)",
      }}
    >
      <div className="text-4xl mb-3">🎯</div>
      <h3 className="text-xl font-bold mb-2" style={{ color: "#FFFFFF" }}>
        {section.title || "Lesson complete!"}
      </h3>
      <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "#C0CCD6" }}>
        {section.content}
      </p>
      {section.nextPreview && !isLast && (
        <p className="text-sm mb-6" style={{ color: "#00E676" }}>
          ✦ Next up: {section.nextPreview}
        </p>
      )}
      <a
        href={nextHref}
        onClick={handleNext}
        className="inline-block px-6 py-3 rounded-xl font-semibold transition-colors"
        style={{
          background: "#00E676",
          color: "#080D12",
          boxShadow: "0 0 16px rgba(0,230,118,0.3)",
        }}
      >
        {marking ? "..." : isLast ? "Finish path 🎓" : "Continue to next lesson →"}
      </a>
    </div>
  );
}

// ── Section dispatcher ──

export function SectionRenderer({
  section,
  pathId,
  lessonNumber,
  onQuizComplete,
  onSummaryNext,
  isLastLesson,
  nextHref,
}: {
  section: LessonSection;
  pathId: string;
  lessonNumber: number;
  onQuizComplete: (score: number) => void;
  onSummaryNext: () => void;
  isLastLesson: boolean;
  nextHref: string;
}) {
  switch (section.type) {
    case "explanation":
      return <Explanation section={section} />;
    case "example":
      return <Example section={section} />;
    case "key_point":
      return <KeyPoint section={section} />;
    case "try_it":
      return <TryIt section={section} pathId={pathId} lessonNumber={lessonNumber} />;
    case "vocabulary":
      return <Vocabulary section={section} />;
    case "quiz":
      return <Quiz section={section} onComplete={onQuizComplete} />;
    case "summary":
      return (
        <Summary
          section={section}
          onComplete={onSummaryNext}
          isLast={isLastLesson}
          nextHref={nextHref}
        />
      );
    default:
      return null;
  }
}
