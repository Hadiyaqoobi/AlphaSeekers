/**
 * Best-effort PII reduction before text reaches a third-party AI provider
 * (Groq, Google, Hugging Face).
 *
 * What this actually does — no more:
 *   - stripPIIFromContext: replaces the asking student's NAME with "Student" in
 *     the context object the tutor prompt is built from. Teacher names and class
 *     names are kept (educational context, not student PII).
 *   - redactPII: replaces email addresses and phone numbers in free text the
 *     student typed (questions, notes, homework) with [email] / [phone] before
 *     it is sent. Pattern-based, so it can miss unusual formats and it does not
 *     detect names, addresses or ID numbers inside free text.
 *   - scanPromptForPII: a final log-only check over every assembled message.
 *
 * The original text is still stored in our own database (interaction log,
 * notes, submissions); redaction only governs what leaves for the provider.
 */

import type { StudentContext } from "../student-context";

export interface PIIAuditEntry {
  field: string;
  replacement: string;
}

/**
 * Strip the student's name from the context before prompt construction.
 * Returns a sanitized copy — does not mutate the original.
 */
export function stripPIIFromContext(context: StudentContext): {
  sanitizedContext: StudentContext;
  auditLog: PIIAuditEntry[];
} {
  const auditLog: PIIAuditEntry[] = [];

  const sanitized: StudentContext = {
    ...context,
    studentName: "Student",
    // Class names, teacher names are educational context, not student PII — keep them
  };

  if (context.studentName !== "Student") {
    auditLog.push({ field: "studentName", replacement: "Student" });
  }

  return { sanitizedContext: sanitized, auditLog };
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone formats, kept deliberately narrow so numbers in maths/science answers
// ("1234567890", "3.14159 26535") are NOT redacted:
//   - international: + or 00, then 8+ digits with optional separators
//   - Afghan local:  07x xxx xxxx (separators optional)
//   - North-American style: (555) 123-4567, 555-123-4567, 555.123.4567
//     (plain spaces alone are not enough — "100 200 3000" stays)
// Persian/Arabic-Indic digits are normalised for matching only.
const PHONE_RES: RegExp[] = [
  /(?<![\w+.,])(?:\+|00)\d(?:[\s().-]?\d){7,14}(?!\d)/g,
  /(?<![\d.,])0\d{2}[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g,
  /(?<![\d.,])(?:\(\d{3}\)\s?\d{3}[\s.-]|\d{3}([.-])\d{3}\1)\d{4}(?!\d)/g,
];

/** Map Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII, 1:1 by position. */
function asciiDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/**
 * Replace emails and phone numbers in student-written text with placeholders.
 * Safe to call on any string; returns the input unchanged when nothing matches.
 */
export function redactPII(text: string): string {
  if (!text) return text;
  let out = text.replace(EMAIL_RE, "[email]");

  // Match on an ASCII-digit copy (same length, same positions) so Dari users
  // typing ۰۷۹... are covered, then cut the same ranges out of the original.
  for (const re of PHONE_RES) {
    const probe = asciiDigits(out);
    const ranges: Array<[number, number]> = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(probe)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
    }
    for (let i = ranges.length - 1; i >= 0; i -= 1) {
      const [start, end] = ranges[i];
      out = out.slice(0, start) + "[phone]" + out.slice(end);
    }
  }
  return out;
}

/**
 * Log-only check over the assembled prompt (ALL messages, not just the system
 * one). It does not change anything; the redaction happens in redactPII.
 */
export function scanPromptForPII(prompt: string | Array<{ content: string }>): {
  clean: boolean;
  findings: string[];
} {
  const text = typeof prompt === "string" ? prompt : prompt.map((m) => m.content).join("\n");
  const findings: string[] = [];

  if (new RegExp(EMAIL_RE.source).test(text)) {
    findings.push("Email address detected in prompt");
  }
  const probe = asciiDigits(text);
  if (PHONE_RES.some((re) => new RegExp(re.source).test(probe))) {
    findings.push("Phone number detected in prompt");
  }

  return { clean: findings.length === 0, findings };
}
