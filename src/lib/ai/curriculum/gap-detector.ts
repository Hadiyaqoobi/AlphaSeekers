/**
 * Curriculum gap detector.
 *
 * Analyzes AI interaction logs to find topics where students asked questions
 * but the vector store had no good answers (the AI responded with "I don't
 * have information about that in your course materials").
 *
 * A "gap" = a topic asked about 3+ times where >50% of responses signaled no info.
 */

import { prisma } from "@/lib/prisma";

export interface CurriculumGap {
  topic: string;
  questionCount: number;
  uniqueStudents: number;
  badAnswerRatio: number;
  sampleQuestions: string[];
  classId: string | null;
  className: string | null;
  detectedAt: Date;
}

export async function detectCurriculumGaps(params: {
  days?: number;
  minQuestions?: number;
} = {}): Promise<CurriculumGap[]> {
  const { days = 7, minQuestions = 3 } = params;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const interactions = await prisma.aIInteraction.findMany({
    where: {
      createdAt: { gte: since },
      mode: { in: ["study", "explain", "quiz"] },
    },
    select: {
      userId: true,
      query: true,
      topics: true,
      classIds: true,
      answer: true,
    },
  });

  // Group by topic
  const topicMap = new Map<
    string,
    {
      questions: string[];
      userIds: Set<string>;
      classIds: Set<string>;
      hasGoodAnswer: number;
      hasBadAnswer: number;
    }
  >();

  const noInfoPatterns = [
    /don't have (enough )?information/i,
    /not in.*course material/i,
    /no relevant/i,
    /ask your teacher/i,
    /اطلاعات.*ندارم/,
    /مواد درسی.*نیست/,
  ];

  for (const interaction of interactions) {
    const topics = (interaction.topics || "").split(",").filter(Boolean);

    for (const topic of topics) {
      const normalized = topic.toLowerCase().trim();
      if (normalized.length < 3) continue;

      let entry = topicMap.get(normalized);
      if (!entry) {
        entry = {
          questions: [],
          userIds: new Set(),
          classIds: new Set(),
          hasGoodAnswer: 0,
          hasBadAnswer: 0,
        };
        topicMap.set(normalized, entry);
      }

      entry.questions.push(interaction.query);
      entry.userIds.add(interaction.userId);
      if (interaction.classIds) {
        interaction.classIds.split(",").forEach((id) => entry!.classIds.add(id));
      }

      const answer = interaction.answer || "";
      if (noInfoPatterns.some((p) => p.test(answer))) {
        entry.hasBadAnswer += 1;
      } else if (answer.length > 100) {
        entry.hasGoodAnswer += 1;
      }
    }
  }

  const gaps: CurriculumGap[] = [];

  for (const [topic, data] of Array.from(topicMap.entries())) {
    const total = data.hasGoodAnswer + data.hasBadAnswer;
    if (total < minQuestions) continue;

    const badRatio = data.hasBadAnswer / total;
    if (badRatio < 0.5) continue; // Not a gap

    let className: string | null = null;
    let classId: string | null = null;
    if (data.classIds.size > 0) {
      const firstClassId = Array.from(data.classIds)[0];
      const cls = await prisma.class.findUnique({
        where: { id: firstClassId },
        select: { id: true, name: true },
      });
      className = cls?.name || null;
      classId = cls?.id || null;
    }

    gaps.push({
      topic,
      questionCount: data.questions.length,
      uniqueStudents: data.userIds.size,
      badAnswerRatio: Math.round(badRatio * 100) / 100,
      sampleQuestions: data.questions.slice(0, 5),
      classId,
      className,
      detectedAt: new Date(),
    });
  }

  return gaps.sort((a, b) => b.uniqueStudents - a.uniqueStudents);
}
