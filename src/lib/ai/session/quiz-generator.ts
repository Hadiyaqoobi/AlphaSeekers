/**
 * Post-class quiz generator.
 *
 * Takes a session summary and generates 5 questions in a structured JSON format.
 * 2 multiple choice, 2 fill-in-the-blank, 1 short answer.
 */

import { generateCompletion } from "../llm";

export interface QuizQuestion {
  type: "multiple_choice" | "fill_blank" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  questions: QuizQuestion[];
}

export async function generatePostClassQuiz(summary: string): Promise<Quiz> {
  const prompt = `Based on this class session summary, create a 5-question quiz.

SUMMARY:
${summary}

Generate a quiz with:
- 2 multiple choice questions (4 options each, one correct)
- 2 fill-in-the-blank questions
- 1 short answer question

For each question, include the question, the correct answer, and a brief explanation.

Respond ONLY with this exact JSON shape, no other text:
{
  "questions": [
    {"type": "multiple_choice", "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "B", "explanation": "..."},
    {"type": "multiple_choice", "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "explanation": "..."},
    {"type": "fill_blank", "question": "The process of ____ converts sunlight into energy.", "correctAnswer": "photosynthesis", "explanation": "..."},
    {"type": "fill_blank", "question": "...", "correctAnswer": "...", "explanation": "..."},
    {"type": "short_answer", "question": "...", "correctAnswer": "...", "explanation": "..."}
  ]
}`;

  const response = await generateCompletion([
    {
      role: "system",
      content: "You are a quiz writer. Respond ONLY with valid JSON. No preamble.",
    },
    { role: "user", content: prompt },
  ]);

  const cleaned = response.replace(/```json|```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Quiz generator did not return valid JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Quiz;

  // Sanity-check shape
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error("Quiz has no questions");
  }

  return parsed;
}
