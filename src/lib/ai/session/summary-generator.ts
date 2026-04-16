/**
 * Class session summary generator.
 *
 * After class ends, generates a markdown summary covering:
 *   1. Key topics
 *   2. Vocabulary
 *   3. Main takeaways
 *   4. Suggested review
 *   5. Common questions students asked
 *
 * Uses Groq (with Gemma fallback) for generation.
 */

import { prisma } from "@/lib/prisma";
import { generateCompletion } from "../llm";

export async function generateSessionSummary(sessionId: string): Promise<string> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      class: { select: { name: true } },
    },
  });
  if (!session) throw new Error("Session not found");

  // Materials uploaded for this class (limited to recent ones)
  const materials = await prisma.material.findMany({
    where: { classId: session.classId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { title: true, fileUrl: true },
  });

  // RAG chunks tied to this class (for content)
  const chunks = await prisma.documentChunk.findMany({
    where: { classId: session.classId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { content: true, sourceTitle: true },
  });

  // Anonymized notes from students
  const notes = await prisma.sessionNote.findMany({
    where: { sessionId },
    select: { content: true },
  });

  // Quick AI questions asked during class
  const sessionEnd = session.endTime || new Date(session.startTime.getTime() + 90 * 60 * 1000);
  const quickQuestions = await prisma.aIInteraction.findMany({
    where: {
      classIds: { contains: session.classId },
      createdAt: { gte: session.startTime, lte: sessionEnd },
    },
    select: { query: true },
    take: 20,
  });

  const materialsList = materials.length > 0
    ? materials.map((m) => `- ${m.title}`).join("\n")
    : "No materials uploaded yet for this class.";

  const chunksList = chunks.length > 0
    ? chunks.slice(0, 5).map((c) => `[${c.sourceTitle}]: ${c.content.substring(0, 400)}`).join("\n\n")
    : "";

  const notesList = notes.length > 0
    ? notes.slice(0, 10).map((n) => n.content.substring(0, 300)).join("\n---\n")
    : "(No student notes yet)";

  const questionsList = quickQuestions.length > 0
    ? quickQuestions.map((q) => `- ${q.query}`).join("\n")
    : "(No questions asked during class)";

  const summaryPrompt = `Generate a class session summary in markdown.

CLASS: ${session.class.name}
DATE: ${session.startTime.toISOString().split("T")[0]}

MATERIALS LISTED FOR THIS CLASS:
${materialsList}

CONTENT FROM CLASS MATERIALS (RAG chunks):
${chunksList || "(No indexed content)"}

ANONYMIZED STUDENT NOTES:
${notesList}

QUESTIONS STUDENTS ASKED DURING CLASS:
${questionsList}

Create a concise, useful summary with these sections (use ## headings):
## Key Topics Covered
3-5 bullet points

## Important Vocabulary
List of terms with simple definitions

## Main Takeaways
What students should remember most

## Suggested Review
What to study before next class

## Common Questions
Based on what students asked

Keep it focused and student-friendly. Maximum 600 words. Use clear, simple language.`;

  const summary = await generateCompletion([
    {
      role: "system",
      content:
        "You are an expert education content writer. Generate clear, concise class summaries.",
    },
    { role: "user", content: summaryPrompt },
  ]);

  return summary;
}
