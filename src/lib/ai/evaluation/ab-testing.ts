/**
 * A/B testing for prompt strategies.
 *
 * Each student request is deterministically assigned to variant A or B.
 * The variant is recorded with the evaluation score.
 * Admin dashboard shows comparative performance.
 */

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variantA: { label: string; promptModification: string };
  variantB: { label: string; promptModification: string };
  active: boolean;
}

/**
 * Active A/B test. Set to null to disable.
 * Change this to run different experiments.
 */
export const ACTIVE_AB_TEST: ABTestConfig | null = {
  id: "explain-strategy-v1",
  name: "Explanation strategy: step-by-step vs analogy-first",
  description:
    "Testing whether step-by-step or analogy-first explanations get higher pedagogy scores",
  variantA: {
    label: "Step-by-step",
    promptModification:
      'When explaining concepts, break them into numbered steps. Start with the simplest step and build up. Example: "Step 1: ..., Step 2: ..., Step 3: ..."',
  },
  variantB: {
    label: "Analogy-first",
    promptModification:
      'When explaining concepts, start with a real-world analogy the student can relate to. Then connect the analogy to the concept. Example: "Think of it like [analogy]... In the same way, [concept] works by..."',
  },
  active: true,
};

/**
 * Assign a variant for this request.
 * Uses consistent hashing so the same student always gets the same variant.
 */
export function assignVariant(
  studentId: string,
): { variant: "A" | "B"; promptAddition: string } | null {
  if (!ACTIVE_AB_TEST || !ACTIVE_AB_TEST.active) return null;

  const hash = simpleHash(studentId + ACTIVE_AB_TEST.id);
  const isA = hash % 2 === 0;

  return {
    variant: isA ? "A" : "B",
    promptAddition: isA
      ? ACTIVE_AB_TEST.variantA.promptModification
      : ACTIVE_AB_TEST.variantB.promptModification,
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
