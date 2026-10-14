/**
 * Lightweight keyword safety checks.
 *
 * - prescreenQuery: runs on the student's QUESTION before any generation.
 *   This is the only check that can stop a streamed answer.
 * - classifyContent: runs on a finished answer. On the streaming path it can
 *   only log (the text was already shown); the non-streaming path uses it to
 *   swap in getSafeResponse() before returning.
 *
 * Keyword lists are short and English-heavy; treat them as a tripwire, not a
 * moderation system.
 */

import { detectDistress } from "./guardrails";

export interface SafetyCheckResult {
  safe: boolean;
  category: string | null;
  action: "allow" | "warn" | "block";
  reason: string | null;
}

export function classifyContent(response: string, query: string): SafetyCheckResult {
  // Check 1: Harmful content
  const harmfulPatterns = [
    { pattern: /how to (make|build|create) (a )?(bomb|weapon|explosive)/i, cat: "harmful" },
    { pattern: /instructions for (violence|harm|attack)/i, cat: "harmful" },
    { pattern: /(?<!\p{L})(suicide method|self.harm technique)(?!\p{L})/iu, cat: "harmful" },
  ];

  for (const { pattern, cat } of harmfulPatterns) {
    if (pattern.test(response) || pattern.test(query)) {
      return {
        safe: false,
        category: cat,
        action: "block",
        reason: `Matched harmful content pattern`,
      };
    }
  }

  // Check 2: Off-topic for education (warn only)
  const offTopicPatterns = [
    /(?<!\p{L})(stock market|cryptocurrency|betting|gambling)(?!\p{L})/iu,
    /(?<!\p{L})(dating advice|romantic relationship)(?!\p{L})/iu,
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(response)) {
      return {
        safe: true,
        category: "off_topic",
        action: "warn",
        reason: "Response may be off-topic for educational context",
      };
    }
  }

  // Check 3: Runaway generation
  if (response.length > 10000) {
    return {
      safe: true,
      category: "off_topic",
      action: "warn",
      reason: "Response exceeds 10,000 characters — possible runaway generation.",
    };
  }

  return { safe: true, category: null, action: "allow", reason: null };
}

export interface PrescreenResult {
  /** allow = answer normally; block = do not generate; support = answer with care. */
  action: "allow" | "block" | "support";
  category: string | null;
  reason: string | null;
}

const HARMFUL_REQUEST_PATTERNS: RegExp[] = [
  /how (to|do i|can i) (make|build|create) (a |an )?(bomb|weapon|explosive)/i,
  /instructions for (violence|harm|attack)/i,
  /(?<!\p{L})(suicide method|self.harm technique)(?!\p{L})/iu,
];

/**
 * Screen the student's question BEFORE anything is generated.
 *
 * - A request for harmful instructions is blocked (caller sends getSafeResponse).
 * - A distress signal is NOT blocked — refusing a student in distress is the
 *   wrong response — but the caller must tell the model to answer briefly, with
 *   empathy, and point to a trusted adult or teacher; it is also logged.
 */
export function prescreenQuery(query: string): PrescreenResult {
  if (HARMFUL_REQUEST_PATTERNS.some((p) => p.test(query))) {
    return { action: "block", category: "harmful", reason: "Harmful request pattern in question" };
  }
  if (detectDistress(query)) {
    return { action: "support", category: "distress", reason: "Distress signal in question" };
  }
  return { action: "allow", category: null, reason: null };
}

/** Extra system-prompt text for a question flagged action === "support". */
export const DISTRESS_PROMPT_ADDITION =
  "IMPORTANT: The student's message may show emotional distress or thoughts of self-harm. " +
  "Do not answer it as a study question and do not give therapy or advice about methods. " +
  "Reply briefly and warmly, in the student's language: acknowledge their feelings, tell them " +
  "they are not alone, and urge them to talk right now to a trusted adult, family member, or their teacher.";

/**
 * Safe fallback response when content is blocked.
 */
export function getSafeResponse(locale: string): string {
  if (locale === "fa") {
    return "متأسفم، نمی‌توانم به این سوال پاسخ دهم. لطفاً سوال دیگری درباره مواد درسی خود بپرسید، یا از معلم خود کمک بخواهید.";
  }
  return "I'm not able to answer that question. Please ask me something about your course materials, or reach out to your teacher for help with this topic.";
}
