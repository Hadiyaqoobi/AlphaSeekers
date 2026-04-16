/**
 * Confidence scoring for AI responses based on retrieval quality.
 *
 * Makes the AI's uncertainty VISIBLE to the student.
 *
 * Score ranges:
 *   0.8 - 1.0 = HIGH   (strong source match)
 *   0.5 - 0.79 = MEDIUM (partial match, may be inferred)
 *   0.0 - 0.49 = LOW    (weak/no match, student should ask teacher)
 */

export interface ConfidenceScore {
  score: number;
  level: "high" | "medium" | "low";
  label: string;
  labelDari: string;
  reasoning: string;
}

export function calculateConfidence(
  retrievedChunks: { similarity: number }[],
  mode: string,
): ConfidenceScore {
  if (retrievedChunks.length === 0) {
    return {
      score: 0.1,
      level: "low",
      label: "Not found in course materials — ask your teacher",
      labelDari: "در مواد درسی پیدا نشد — از معلم خود بپرسید",
      reasoning: "No chunks retrieved. Answer would be entirely generated without source material.",
    };
  }

  const bestSimilarity = Math.max(...retrievedChunks.map((c) => c.similarity));
  const chunkCount = retrievedChunks.length;
  const breadthScore = Math.min(chunkCount / 3, 1);

  // Practice/quiz modes don't need high retrieval confidence
  const modeMultiplier = ["practice", "quiz"].includes(mode) ? 1.2 : 1.0;

  const rawScore =
    (bestSimilarity * 0.6 + breadthScore * 0.3 + (chunkCount > 0 ? 0.1 : 0)) * modeMultiplier;

  const score = Math.min(Math.max(rawScore, 0), 1);

  if (score >= 0.8) {
    return {
      score,
      level: "high",
      label: "Based on your course materials",
      labelDari: "بر اساس مواد درسی شما",
      reasoning: `Strong match: best similarity ${(bestSimilarity * 100).toFixed(0)}%, ${chunkCount} chunks.`,
    };
  }

  if (score >= 0.5) {
    return {
      score,
      level: "medium",
      label: "Partially found in course materials",
      labelDari: "تا حدی در مواد درسی یافت شد",
      reasoning: `Partial match: best similarity ${(bestSimilarity * 100).toFixed(0)}%, ${chunkCount} chunks.`,
    };
  }

  return {
    score,
    level: "low",
    label: "Limited information — consider asking your teacher",
    labelDari: "اطلاعات محدود — از معلم خود بپرسید",
    reasoning: `Weak match: best similarity ${(bestSimilarity * 100).toFixed(0)}%, ${chunkCount} chunks.`,
  };
}
