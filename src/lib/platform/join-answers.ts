/**
 * Server side of the sign-up answers (ADR-0009): storing them, reading them
 * back for staff, and the spreadsheet export.
 *
 * A phone number given in an answer is encrypted at rest exactly like
 * User.phone, so adding the question does not put phone numbers in the database
 * in a form the account table deliberately avoids.
 */
import { decryptPhone, encryptPhone } from "@/lib/security/phone-crypto";
import { readAnswers, type JoinAnswers, type JoinQuestion } from "@/lib/platform/join-questions";

/** The answers as they are written to Enrollment.answers. */
export function sealAnswers(answers: JoinAnswers): JoinAnswers | undefined {
  if (Object.keys(answers).length === 0) return undefined;
  const sealed = { ...answers };
  if (sealed.phone) sealed.phone = encryptPhone(sealed.phone);
  return sealed;
}

/** Enrollment.answers as staff should read them. */
export function openAnswers(stored: unknown): JoinAnswers {
  const answers = readAnswers(stored);
  if (answers.phone) {
    try {
      answers.phone = decryptPhone(answers.phone);
    } catch {
      // A value that fails its integrity check is not shown rather than shown wrong.
      delete answers.phone;
    }
  }
  return answers;
}

/**
 * A spreadsheet cell. Quoted always; and a value starting with = + - @ (or a
 * tab/CR) is prefixed with ' so Google Sheets and Excel show it as text instead
 * of running it as a formula — the answers are typed by the public.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * The whole file. Starts with a UTF-8 byte-order mark: without it Excel opens
 * Dari text as mojibake. CRLF line ends, the CSV standard.
 */
export function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** One answer as a person reads it: a preset choice shows its translated label. */
export function displayAnswer(
  question: JoinQuestion,
  answer: string | undefined,
  optionLabel: (question: JoinQuestion, option: string) => string,
): string {
  if (!answer) return "";
  return question.kind !== "custom" && question.type === "choice" ? optionLabel(question, answer) : answer;
}
