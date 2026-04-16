/**
 * Lightweight post-generation safety check.
 *
 * Runs AFTER the LLM generates a response.
 * For streaming (Approach A): checks after full collection, logs violations.
 */

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
    { pattern: /\b(suicide method|self.harm technique)\b/i, cat: "harmful" },
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
    /\b(stock market|cryptocurrency|betting|gambling)\b/i,
    /\b(dating advice|romantic relationship)\b/i,
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

/**
 * Safe fallback response when content is blocked.
 */
export function getSafeResponse(locale: string): string {
  if (locale === "fa") {
    return "متأسفم، نمی‌توانم به این سوال پاسخ دهم. لطفاً سوال دیگری درباره مواد درسی خود بپرسید، یا از معلم خود کمک بخواهید.";
  }
  return "I'm not able to answer that question. Please ask me something about your course materials, or reach out to your teacher for help with this topic.";
}
