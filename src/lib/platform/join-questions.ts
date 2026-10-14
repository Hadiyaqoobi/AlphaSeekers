/**
 * A class's own sign-up questions (ADR-0009).
 *
 * The team kept asking for "a Google Form for each class" because the join page
 * only asked for name, email and a password, and they needed a phone number, an
 * English level, a reason for joining. A real Google Form would leave the
 * student OUTSIDE the class (no account, no Meet link, no reminders), so the
 * questions live on the join page instead and the answers are saved with the
 * enrolment, in the same request that takes the seat.
 *
 * Two kinds of question:
 *  - READY-MADE ones (phone, age, province, English level, reason): staff tick a
 *    box. Their wording comes from the translation files, so they read in Dari
 *    on the Dari site once the team supplies it, whatever language the staff
 *    member posting the class uses.
 *  - The class's OWN ones (at most five): staff type the question, in whatever
 *    language they want students to read it, and pick short answer, paragraph
 *    or one-of-several.
 *
 * Client-safe: no server imports. The join form, the class form and the server
 * all validate with these same functions, so they cannot disagree.
 */
import { z } from "zod";

import { toLatinDigits } from "@/lib/ui/digits";
import { stripHtml } from "@/lib/security/sanitize";

export const PRESET_KINDS = ["phone", "age", "province", "englishLevel", "reason"] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];
export type QuestionType = "short" | "paragraph" | "choice";

export type JoinQuestion = {
  /** Stable key the answers are stored under. A preset's id is its kind. */
  id: string;
  kind: PresetKind | "custom";
  type: QuestionType;
  /** Custom questions only: the question as staff typed it. */
  label?: string;
  /**
   * Choice questions only. For a preset these are option KEYS (translated on
   * screen, stored as the key); for a custom question, the text staff typed.
   */
  options?: string[];
  required: boolean;
};

export type JoinAnswers = Record<string, string>;

/** How each ready-made question behaves. Their labels live in messages/*.json. */
export const PRESETS: Record<PresetKind, { type: QuestionType; options?: string[] }> = {
  phone: { type: "short" },
  age: { type: "short" },
  province: { type: "short" },
  englishLevel: { type: "choice", options: ["beginner", "intermediate", "advanced"] },
  reason: { type: "paragraph" },
};

export const MAX_CUSTOM_QUESTIONS = 5;
export const MAX_CHOICE_OPTIONS = 10;
export const SHORT_ANSWER_MAX = 200;
export const PARAGRAPH_ANSWER_MAX = 2000;
const QUESTION_ID = /^[a-z][a-zA-Z0-9_]{0,23}$/;

const cleanText = (max: number) =>
  z.string().trim().max(max).transform(stripHtml).pipe(z.string().min(1));

const questionInput = z.object({
  id: z.string().regex(QUESTION_ID),
  kind: z.enum([...PRESET_KINDS, "custom"]),
  type: z.enum(["short", "paragraph", "choice"]).optional(),
  label: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
});

/**
 * What staff may save. Presets are normalised to their fixed shape (whatever
 * type/options the client sent are ignored), custom questions are checked.
 */
export const joinQuestionsSchema = z
  .array(questionInput)
  .max(PRESET_KINDS.length + MAX_CUSTOM_QUESTIONS)
  .transform((list, ctx): JoinQuestion[] => {
    const seen = new Set<string>();
    const out: JoinQuestion[] = [];
    let customCount = 0;

    list.forEach((question, index) => {
      if (question.kind !== "custom") {
        if (seen.has(question.kind)) return; // a preset ticked twice is the same question
        seen.add(question.kind);
        const preset = PRESETS[question.kind];
        out.push({
          id: question.kind,
          kind: question.kind,
          type: preset.type,
          ...(preset.options ? { options: [...preset.options] } : {}),
          required: question.required,
        });
        return;
      }

      customCount += 1;
      if (customCount > MAX_CUSTOM_QUESTIONS) {
        ctx.addIssue({ code: "custom", path: [index], message: `At most ${MAX_CUSTOM_QUESTIONS} questions of your own.` });
        return;
      }
      if (seen.has(question.id) || (PRESET_KINDS as readonly string[]).includes(question.id)) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate question." });
        return;
      }
      seen.add(question.id);

      const label = cleanText(200).safeParse(question.label ?? "");
      if (!label.success) {
        ctx.addIssue({ code: "custom", path: [index, "label"], message: "Type the question." });
        return;
      }
      const type = question.type ?? "short";

      if (type === "choice") {
        const options = [
          ...new Set((question.options ?? []).map((o) => stripHtml(o.trim()).slice(0, 100)).filter(Boolean)),
        ];
        if (options.length < 2 || options.length > MAX_CHOICE_OPTIONS) {
          ctx.addIssue({
            code: "custom",
            path: [index, "options"],
            message: `A choice question needs 2 to ${MAX_CHOICE_OPTIONS} answers to pick from.`,
          });
          return;
        }
        out.push({ id: question.id, kind: "custom", type, label: label.data, options, required: question.required });
        return;
      }

      out.push({ id: question.id, kind: "custom", type, label: label.data, required: question.required });
    });

    return out;
  });

/**
 * Read a class's stored questions. Tolerant on purpose: a value that does not
 * parse (hand-edited, or from a future version) means "no questions", never a
 * join page that crashes.
 */
export function readJoinQuestions(stored: unknown): JoinQuestion[] {
  if (!Array.isArray(stored) || stored.length === 0) return [];
  const parsed = joinQuestionsSchema.safeParse(stored);
  return parsed.success ? parsed.data : [];
}

export type AnswerCheck =
  | { ok: true; answers: JoinAnswers }
  | { ok: false; questionId: string; reason: "required" | "invalid" };

/**
 * Check a student's answers against the class's questions. Returns only the
 * answers to questions the class actually asks (unknown keys are dropped), each
 * trimmed and normalised: Dari digits become 0-9 for phone and age, so the team
 * can read and dial them.
 */
export function checkAnswers(questions: JoinQuestion[], raw: unknown): AnswerCheck {
  const given = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const answers: JoinAnswers = {};

  for (const question of questions) {
    const value = typeof given[question.id] === "string" ? stripHtml((given[question.id] as string).trim()) : "";
    if (!value) {
      if (question.required) return { ok: false, questionId: question.id, reason: "required" };
      continue;
    }

    const normalised = normaliseAnswer(question, value);
    if (normalised === null) return { ok: false, questionId: question.id, reason: "invalid" };
    answers[question.id] = normalised;
  }

  return { ok: true, answers };
}

function normaliseAnswer(question: JoinQuestion, value: string): string | null {
  if (question.kind === "phone") {
    const latin = toLatinDigits(value).replace(/\s+/g, " ");
    const digits = latin.replace(/[^0-9]/g, "");
    if (!/^\+?[0-9 ()-]+$/.test(latin) || digits.length < 6 || digits.length > 20) return null;
    return latin;
  }
  if (question.kind === "age") {
    const latin = toLatinDigits(value);
    if (!/^[0-9]{1,3}$/.test(latin)) return null;
    const age = Number(latin);
    return age >= 5 && age <= 100 ? String(age) : null;
  }
  if (question.type === "choice") {
    return question.options?.includes(value) ? value : null;
  }
  const max = question.type === "paragraph" ? PARAGRAPH_ANSWER_MAX : SHORT_ANSWER_MAX;
  return value.length <= max ? value : null;
}

/** Answers as stored on an enrolment; anything unexpected reads as "no answers". */
export function readAnswers(stored: unknown): JoinAnswers {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const out: JoinAnswers = {};
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** What a question says on screen. Presets read from the "joinQuestions" messages. */
export function questionLabel(question: JoinQuestion, t: (key: string) => string): string {
  return question.kind === "custom" ? question.label ?? "" : t(`labels.${question.kind}`);
}

/** What a choice says on screen. A preset's options are keys; a custom one's are text. */
export function optionLabel(question: JoinQuestion, option: string, t: (key: string) => string): string {
  return question.kind === "custom" ? option : t(`options.${question.kind}.${option}`);
}
