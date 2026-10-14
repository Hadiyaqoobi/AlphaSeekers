/**
 * Educational guardrails.
 *
 * Each principle has:
 * - A rule the AI must follow (injected into the system prompt)
 * - A post-hoc check function over the finished answer
 * - A severity level
 *
 * HONEST SCOPE: the post-hoc checks are simple keyword patterns and they run
 * AFTER generation. On the streaming study-assistant path the student has
 * already seen the answer by then, so a "block" here is recorded in
 * AISafetyLog for staff review — it cannot retract text. The only checks that
 * stop an answer before the student sees it are the question pre-screen
 * (prescreenQuery in content-classifier.ts) and, on the non-streaming path,
 * classifyContent before the answer is returned.
 */

// Boundaries: JavaScript's \b only knows ASCII word characters, so it NEVER
// matches between two Persian letters — a \b-wrapped Dari pattern can only
// match at the start/end of the whole string. Unicode-aware lookarounds over
// \p{L} (with the `u` flag) work for both scripts.
const DISTRESS_PATTERNS: RegExp[] = [
  /(?<!\p{L})(suicid\p{L}*|self.harm|hurt myself|kill myself|want to die)(?!\p{L})/iu,
  // TODO(team): only two Dari phrases exist; a native speaker should extend this list.
  /(?<!\p{L})(خودکشی|کسی مرا نمی‌خواهد)(?!\p{L})/u,
];

/** Does the text contain a self-harm / distress signal? */
export function detectDistress(text: string): boolean {
  return DISTRESS_PATTERNS.some((p) => p.test(text));
}

export interface GuardrailResult {
  passed: boolean;
  violations: {
    principle: string;
    severity: "warn" | "block";
    description: string;
  }[];
}

type PrincipleCheck = (
  response: string,
  chunks: string[],
  query: string,
) => { passed: boolean; severity: "warn" | "block" };

interface EducationalPrinciple {
  id: string;
  rule: string;
  check: PrincipleCheck;
}

export const EDUCATIONAL_PRINCIPLES: EducationalPrinciple[] = [
  {
    id: "factual_grounding",
    rule: 'Answer ONLY using the provided course material context. If the context does not contain the answer, say "I don\'t have information about that in your course materials." NEVER fabricate facts, quotes, dates, or examples.',
    check: (response, chunks) => {
      const suspiciousPatterns = [
        /according to .{3,30} (study|research|report)/i,
        /studies (show|suggest|indicate|prove)/i,
        /research (shows|proves|indicates)/i,
        /\d{4} (study|paper|report) (by|from|in)/i,
      ];
      const hasChunks = chunks.length > 0;
      const hasSuspicious = suspiciousPatterns.some((p) => p.test(response));
      return { passed: hasChunks || !hasSuspicious, severity: "warn" as const };
    },
  },
  {
    id: "age_appropriate",
    rule: "All content must be appropriate for students aged 14-25. Never include graphic violence, sexual content, profanity, or content that could be psychologically harmful.",
    check: (response) => {
      const flagged = [
        /(?<!\p{L})(porn|explicit sexual|graphic violence)(?!\p{L})/iu,
      ].some((p) => p.test(response));
      return { passed: !flagged, severity: "block" as const };
    },
  },
  {
    id: "pedagogical_approach",
    rule: "Guide students toward understanding — do not simply give answers. When a student asks a factual question, answer it clearly, then offer to explain deeper. For quizzes, always explain WHY the correct answer is correct.",
    check: () => ({ passed: true, severity: "warn" as const }),
  },
  {
    id: "honest_uncertainty",
    rule: 'If you are not confident about an answer, say so. Use phrases like "Based on your course materials, I think..." or "I\'m not sure about this — you should ask your teacher." NEVER present uncertain information as definitive fact.',
    check: () => ({ passed: true, severity: "warn" as const }),
  },
  {
    id: "no_political_religious",
    rule: "Never express political opinions, religious interpretations, or take sides on controversial social issues. If asked, acknowledge the question respectfully and redirect to the teacher.",
    check: (response) => {
      const flagged = [
        /government should/i,
        /religion is (right|wrong|true|false)/i,
      ].some((p) => p.test(response));
      return { passed: !flagged, severity: "warn" as const };
    },
  },
  {
    id: "student_wellbeing",
    rule: "If a student expresses distress or mentions self-harm, respond with empathy and immediately suggest they speak with a trusted adult or teacher. Do NOT attempt to provide therapy.",
    check: (response, _chunks, query) => {
      const studentDistressed = detectDistress(query);
      const aiWroteLongCounseling = response.length > 500 && studentDistressed;
      return { passed: !aiWroteLongCounseling, severity: "warn" as const };
    },
  },
];

/**
 * Run all guardrail checks against a response.
 */
export function checkGuardrails(
  response: string,
  retrievedChunks: string[],
  studentQuery: string,
): GuardrailResult {
  const violations: GuardrailResult["violations"] = [];

  for (const principle of EDUCATIONAL_PRINCIPLES) {
    const result = principle.check(response, retrievedChunks, studentQuery);
    if (!result.passed) {
      violations.push({
        principle: principle.id,
        severity: result.severity,
        description: `Violated: ${principle.id}`,
      });
    }
  }

  return {
    passed: violations.filter((v) => v.severity === "block").length === 0,
    violations,
  };
}

/**
 * Get guardrail rules formatted for injection into the system prompt.
 */
export function getGuardrailRulesForPrompt(): string {
  return `EDUCATIONAL SAFETY PRINCIPLES (you MUST follow these):
${EDUCATIONAL_PRINCIPLES.map((p, i) => `${i + 1}. ${p.rule}`).join("\n")}`;
}
