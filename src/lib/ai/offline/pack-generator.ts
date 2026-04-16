/**
 * Offline answer pack generator.
 *
 * Bundles the top Q&A pairs for a class into a JSON file the student
 * can download over WiFi and use offline (e.g. during internet shutdowns).
 */

import { prisma } from "@/lib/prisma";

export interface AnswerPackItem {
  question: string;
  answer: string;
  sources: string[];
  topics: string[];
}

export interface AnswerPack {
  classId: string;
  className: string;
  generatedAt: string;
  version: number;
  items: AnswerPackItem[];
}

export async function generateAnswerPack(classId: string): Promise<AnswerPack> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true },
  });

  if (!cls) throw new Error("Class not found");

  const interactions = await prisma.aIInteraction.findMany({
    where: {
      classIds: { contains: classId },
      answer: { not: null },
      mode: { in: ["study", "explain"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      query: true,
      answer: true,
      sources: true,
      topics: true,
    },
  });

  // Deduplicate by normalized question prefix
  const seen = new Map<string, (typeof interactions)[number]>();
  for (const interaction of interactions) {
    const key = interaction.query.toLowerCase().trim().substring(0, 50);
    if (!seen.has(key)) {
      seen.set(key, interaction);
    }
  }

  const items: AnswerPackItem[] = Array.from(seen.values())
    .filter((i) => i.answer && i.answer.length > 50)
    .slice(0, 100)
    .map((i) => {
      let sourceTitles: string[] = [];
      if (i.sources) {
        try {
          const parsed = JSON.parse(i.sources);
          if (Array.isArray(parsed)) {
            sourceTitles = parsed.map((s: { title?: string }) => s.title || "").filter(Boolean);
          }
        } catch {
          // ignore malformed sources
        }
      }
      return {
        question: i.query,
        answer: i.answer || "",
        sources: sourceTitles,
        topics: i.topics ? i.topics.split(",").filter(Boolean) : [],
      };
    });

  return {
    classId,
    className: cls.name,
    generatedAt: new Date().toISOString(),
    version: 1,
    items,
  };
}
