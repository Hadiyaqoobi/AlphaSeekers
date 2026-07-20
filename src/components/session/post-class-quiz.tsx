"use client";

import { useState } from "react";

type Question = {
  type: "multiple_choice" | "fill_blank" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
};

interface PostClassQuizProps {
  questions: Question[];
}

export function PostClassQuiz({ questions }: PostClassQuizProps) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<{ correct: boolean; userAnswer: string }[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  if (!questions || questions.length === 0) return null;

  if (!started) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5">
        <h3 className="text-base font-bold text-amber-900 mb-1">📝 Post-class quiz</h3>
        <p className="text-sm text-amber-800 mb-4">
          {questions.length} questions · Test your understanding of today&apos;s lesson.
        </p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="px-5 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
        >
          Start quiz →
        </button>
      </div>
    );
  }

  // Final score view
  if (index >= questions.length) {
    const correctCount = answers.filter((a) => a.correct).length;
    const pct = Math.round((correctCount / questions.length) * 100);

    return (
      <div className="rounded-2xl bg-dark-100 border border-line p-6 text-center">
        <div className="text-5xl mb-2">{pct >= 80 ? "🎉" : pct >= 60 ? "👍" : "💪"}</div>
        <h3 className="text-xl font-bold text-ink-main mb-1">
          {correctCount} / {questions.length} correct
        </h3>
        <p className="text-ink-soft mb-6">
          {pct >= 80
            ? "Great work — you really understood today's lesson!"
            : pct >= 60
              ? "Good progress. Review the topics you missed."
              : "Don't worry. Review the materials and try again."}
        </p>
        <button
          type="button"
          onClick={() => {
            setStarted(false);
            setIndex(0);
            setAnswers([]);
            setCurrentAnswer("");
            setShowFeedback(false);
          }}
          className="px-5 py-2 rounded-lg bg-neon-600 text-white font-semibold hover:bg-neon-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const question = questions[index];
  const isCorrect = currentAnswer.trim().toLowerCase() === question.correctAnswer.toLowerCase();

  const submitAnswer = () => {
    if (!currentAnswer.trim() || showFeedback) return;
    setShowFeedback(true);
  };

  const next = () => {
    setAnswers((prev) => [...prev, { correct: isCorrect, userAnswer: currentAnswer }]);
    setIndex(index + 1);
    setCurrentAnswer("");
    setShowFeedback(false);
  };

  return (
    <div className="rounded-2xl bg-dark-100 border border-line p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
          Question {index + 1} of {questions.length}
        </span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < index ? "bg-neon-500" : i === index ? "bg-neon-300" : "bg-dark-200"
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-base font-medium text-ink-main mb-4">{question.question}</p>

      {/* Multiple choice */}
      {question.type === "multiple_choice" && question.options && (
        <div className="space-y-2 mb-4">
          {question.options.map((opt, i) => {
            const isSelected = currentAnswer === opt;
            const isCorrectChoice = showFeedback && opt.toLowerCase() === question.correctAnswer.toLowerCase();
            const isWrongChoice = showFeedback && isSelected && !isCorrectChoice;
            return (
              <button
                key={i}
                type="button"
                onClick={() => !showFeedback && setCurrentAnswer(opt)}
                disabled={showFeedback}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  isCorrectChoice
                    ? "border-neon-500 bg-neon-50 text-neon-900"
                    : isWrongChoice
                      ? "border-red-300 bg-red-50 text-red-900"
                      : isSelected
                        ? "border-neon-300 bg-neon-50/50"
                        : "border-line hover:border-line bg-dark-100"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* Fill blank / short answer */}
      {(question.type === "fill_blank" || question.type === "short_answer") && (
        <input
          type="text"
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
          disabled={showFeedback}
          placeholder="Type your answer..."
          className={`w-full rounded-lg border px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-neon-500/30 disabled:bg-dark-50 ${
            showFeedback
              ? isCorrect
                ? "border-neon-300"
                : "border-red-300"
              : "border-line focus:border-neon-400"
          }`}
        />
      )}

      {/* Feedback */}
      {showFeedback && (
        <div
          className={`rounded-lg p-3 mb-3 text-sm ${
            isCorrect ? "bg-neon-50 text-neon-900" : "bg-amber-50 text-amber-900"
          }`}
        >
          {!isCorrect && (
            <p className="font-semibold mb-1">
              The correct answer is: <span className="font-bold">{question.correctAnswer}</span>
            </p>
          )}
          {isCorrect && <p className="font-semibold mb-1">✓ Correct!</p>}
          {question.explanation && <p className="text-xs opacity-90 mt-1">{question.explanation}</p>}
        </div>
      )}

      {/* Action button */}
      {!showFeedback ? (
        <button
          type="button"
          onClick={submitAnswer}
          disabled={!currentAnswer.trim()}
          className="w-full px-4 py-2.5 rounded-lg bg-neon-600 text-white font-semibold hover:bg-neon-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Check answer
        </button>
      ) : (
        <button
          type="button"
          onClick={next}
          className="w-full px-4 py-2.5 rounded-lg bg-dark-DEFAULT text-white font-semibold hover:bg-dark-DEFAULT"
        >
          {index < questions.length - 1 ? "Next question →" : "See results →"}
        </button>
      )}
    </div>
  );
}
