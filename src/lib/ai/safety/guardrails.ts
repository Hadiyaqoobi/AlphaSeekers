/**
 * Educational guardrails — modeled after Anthropic's Constitutional AI.
 *
 * Each principle has:
 * - A rule the AI must follow (injected into the system prompt)
 * - A post-hoc check function (validates the response after generation)
 * - A severity level (warn = log only, block = substitute safe response)
 */

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
        /\b(porn|explicit sexual|graphic violence)\b/i,
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
      const distressPatterns = [
        /\b(suicid|self.harm|hurt myself|want to die)\b/i,
        /\b(خودکشی|کسی مرا نمی‌خواهد)\b/i,
      ];
      const studentDistressed = distressPatterns.some((p) => p.test(query));
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
