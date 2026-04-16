/**
 * Ensures no personally identifiable information reaches the LLM provider.
 *
 * The LLM sees: "Student enrolled in English A2"
 * NOT: "Fatima Ahmadi (fatima@gmail.com) enrolled in English A2"
 *
 * Defense-in-depth: even if the LLM provider is compromised,
 * no student PII is exposed.
 */

import type { StudentContext } from "../student-context";

export interface PIIAuditEntry {
  field: string;
  replacement: string;
}

/**
 * Strip PII from the student context before prompt construction.
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

/**
 * Scan the assembled prompt for any PII that might have leaked through.
 * Run as a final check before sending to the LLM provider.
 */
export function scanPromptForPII(prompt: string): {
  clean: boolean;
  findings: string[];
} {
  const findings: string[] = [];

  // Email
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(prompt)) {
    findings.push("Email address detected in prompt");
  }

  // International phone
  if (/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(prompt)) {
    findings.push("Phone number detected in prompt");
  }

  // Afghan phone
  if (/\+?93\d{9}/.test(prompt)) {
    findings.push("Afghan phone number detected in prompt");
  }

  return { clean: findings.length === 0, findings };
}
