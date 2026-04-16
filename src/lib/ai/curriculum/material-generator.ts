/**
 * Auto-generate supplementary study materials for detected curriculum gaps.
 *
 * The output is a DRAFT — teachers must review before it's ingested into
 * the vector store. Human-in-the-loop.
 */

import { aiConfig } from "../config";
import type { CurriculumGap } from "./gap-detector";

export interface GeneratedMaterial {
  title: string;
  content: string;
  targetClass: string | null;
  status: "draft";
}

export async function generateGapMaterial(gap: CurriculumGap): Promise<GeneratedMaterial> {
  if (!aiConfig.gemma.configured) {
    throw new Error("Gemma API key required for material generation");
  }

  const prompt = `You are an educational content writer creating supplementary study material for Afghan students.

TOPIC: ${gap.topic}
CLASS: ${gap.className || "General"}
STUDENT QUESTIONS ABOUT THIS TOPIC (these students couldn't find answers):
${gap.sampleQuestions.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Create a 1-page study material that covers this topic. Include:

1. TITLE: A clear, descriptive title
2. EXPLANATION: A simple, clear explanation of the topic (200-300 words)
   - Use simple vocabulary (B1 level English)
   - Include at least one real-world example or analogy
   - Structure with short paragraphs and bullet points
3. KEY VOCABULARY: 5-8 important terms with simple definitions
4. PRACTICE QUESTIONS: 3 questions the student can try
   - 1 easy, 1 medium, 1 challenging
   - Include the answers at the bottom

Write in English. Keep it accessible for students aged 14-25 who may be learning English as a second language.

Respond with the study material ONLY — no preamble or meta-commentary.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.gemma.model}:generateContent?key=${aiConfig.gemma.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Material generation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const lines = content.split("\n").filter(Boolean);
  const titleLine = lines[0] || "";
  const title =
    titleLine.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim() ||
    `Supplementary: ${gap.topic}`;

  return {
    title,
    content,
    targetClass: gap.className,
    status: "draft",
  };
}
