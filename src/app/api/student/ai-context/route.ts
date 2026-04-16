/**
 * GET /api/student/ai-context
 *
 * Lightweight endpoint for the StudyAssistant client to fetch
 * the student's enrolled classes and schedule. Used to generate
 * personalized suggestion chips in the empty state.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/security/session";

function isLanguageClass(className: string): boolean {
  const keywords = [
    "english", "korean", "chinese", "mandarin", "spanish",
    "arabic", "german", "french", "language", "conversation",
    "grammar", "vocabulary", "speaking", "writing",
  ];
  const lower = className.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: user.id, status: "ACTIVE" },
    include: {
      class: { select: { id: true, name: true, subjectCategory: true } },
    },
  });

  const nextSession = await prisma.session.findFirst({
    where: {
      class: { enrollments: { some: { studentId: user.id, status: "ACTIVE" } } },
      startTime: { gte: new Date() },
      cancelled: false,
    },
    include: { class: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });

  return Response.json({
    enrolledClasses: enrollments.map((e) => ({
      id: e.class.id,
      name: e.class.name,
      category: e.class.subjectCategory,
      isLanguageClass: isLanguageClass(e.class.name),
    })),
    nextClass: nextSession
      ? {
          name: nextSession.class.name,
          startTime: nextSession.startTime,
        }
      : null,
  });
}
