/**
 * Student context assembler for the intelligent AI tutor.
 *
 * Before every AI response, this module builds a rich context object
 * about the student: enrolled classes, schedule, learning history,
 * language level, and detected intent. This drives personalized prompts
 * and enrollment-aware retrieval.
 */

import { prisma } from "@/lib/prisma";

export interface StudentContext {
  // Identity
  studentId: string;
  studentName: string;
  preferredLanguage: "en" | "fa";

  // Enrollment
  enrolledClasses: {
    classId: string;
    className: string;
    subjectCategory: string;
    teacherName: string;
    language: string;
  }[];

  // Schedule
  nextClass: {
    className: string;
    startTime: Date;
    hoursUntil: number;
  } | null;
  lastClass: {
    className: string;
    endedAt: Date;
    hoursAgo: number;
  } | null;

  // Learning history (from past AI interactions)
  recentTopics: string[];
  struggledTopics: string[];
  masteredTopics: string[];
  totalQuestions: number;
  questionsToday: number;

  // Language learning context
  isLanguageLearner: boolean;
  targetLanguage: string | null;
  estimatedLevel: string | null;

  // Detected intent for THIS question
  detectedMode: AiMode;
}

export type AiMode = "study" | "practice" | "quiz" | "explain" | "vocabulary" | "prepare";

export async function buildStudentContext(
  studentId: string,
  question: string,
): Promise<StudentContext> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Fetch all data in parallel
  const [student, enrollments, nextSession, lastSession, recentInteractions, todayCount] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, name: true, language: true },
      }),

      prisma.enrollment.findMany({
        where: { studentId, status: "ACTIVE" },
        include: {
          class: {
            include: {
              teacher: { select: { name: true } },
            },
          },
        },
      }),

      prisma.session.findFirst({
        where: {
          class: { enrollments: { some: { studentId, status: "ACTIVE" } } },
          startTime: { gte: now },
          cancelled: false,
        },
        include: { class: true },
        orderBy: { startTime: "asc" },
      }),

      prisma.session.findFirst({
        where: {
          class: { enrollments: { some: { studentId, status: "ACTIVE" } } },
          startTime: { lt: now },
          cancelled: false,
        },
        include: { class: true },
        orderBy: { startTime: "desc" },
      }),

      prisma.aIInteraction.findMany({
        where: {
          userId: studentId,
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          query: true,
          rating: true,
          topics: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      prisma.aIInteraction.count({
        where: {
          userId: studentId,
          createdAt: { gte: todayStart },
        },
      }),
    ]);

  // Build enrolled classes
  const enrolledClasses = enrollments.map((e) => ({
    classId: e.class.id,
    className: e.class.name,
    subjectCategory: e.class.subjectCategory || "general",
    teacherName: e.class.teacher?.name || "Unknown",
    language: detectClassLanguage(e.class.name, e.class.subjectCategory),
  }));

  // Detect language learning
  const languageClasses = enrolledClasses.filter(
    (c) => c.subjectCategory === "languages" || isLanguageClass(c.className),
  );
  const isLanguageLearner = languageClasses.length > 0;
  const targetLanguage = languageClasses[0]?.language || null;

  // Analyze learning history
  const allQueries = recentInteractions.map((i) => i.query);
  const recentTopics = Array.from(new Set(extractTopics(allQueries))).slice(0, 10);
  const struggledTopics = Array.from(
    new Set(
      recentInteractions
        .filter((i) => i.rating === "negative")
        .flatMap((i) => extractTopics([i.query])),
    ),
  ).slice(0, 5);
  const masteredTopics = Array.from(
    new Set(
      recentInteractions
        .filter((i) => i.rating === "positive")
        .flatMap((i) => extractTopics([i.query])),
    ),
  ).slice(0, 5);

  // Estimate language level
  const estimatedLevel = isLanguageLearner ? estimateLanguageLevel(allQueries) : null;

  // Schedule context
  const nextClass = nextSession
    ? {
        className: nextSession.class.name,
        startTime: nextSession.startTime,
        hoursUntil: (nextSession.startTime.getTime() - now.getTime()) / (1000 * 60 * 60),
      }
    : null;
  const lastClass = lastSession
    ? {
        className: lastSession.class.name,
        endedAt: lastSession.endTime,
        hoursAgo: (now.getTime() - lastSession.endTime.getTime()) / (1000 * 60 * 60),
      }
    : null;

  return {
    studentId,
    studentName: student?.name?.split(" ")[0] || "Student",
    preferredLanguage: student?.language === "FA" ? "fa" : "en",
    enrolledClasses,
    nextClass,
    lastClass,
    recentTopics,
    struggledTopics,
    masteredTopics,
    totalQuestions: recentInteractions.length,
    questionsToday: todayCount,
    isLanguageLearner,
    targetLanguage,
    estimatedLevel,
    detectedMode: detectMode(question),
  };
}

// ── Helpers ──────────────────────────────────────────────────────

function detectClassLanguage(className: string, category: string): string {
  const name = className.toLowerCase();
  if (name.includes("english")) return "english";
  if (name.includes("korean")) return "korean";
  if (name.includes("chinese") || name.includes("mandarin")) return "chinese";
  if (name.includes("spanish")) return "spanish";
  if (name.includes("arabic")) return "arabic";
  if (name.includes("german")) return "german";
  if (name.includes("french")) return "french";
  if (category.toLowerCase() === "languages") return "general language";
  return "general";
}

function isLanguageClass(className: string): boolean {
  const keywords = [
    "english",
    "korean",
    "chinese",
    "mandarin",
    "spanish",
    "arabic",
    "german",
    "french",
    "language",
    "conversation",
    "grammar",
    "vocabulary",
    "speaking",
    "writing",
  ];
  const lower = className.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Detect the student's intent from their question.
 * Supports both English and Dari trigger phrases.
 */
export function detectMode(question: string): AiMode {
  const q = question.toLowerCase();

  const patterns: Record<AiMode, string[]> = {
    practice: [
      "practice with me",
      "let's practice",
      "talk to me in",
      "help me practice",
      "conversation practice",
      "speak with me",
      "chat in english",
      "chat in korean",
      "تمرین",
      "باهم تمرین کنیم",
      "صحبت کن",
    ],
    quiz: [
      "quiz me",
      "test me",
      "ask me questions",
      "give me a quiz",
      "check my knowledge",
      "exam practice",
      "mock test",
      "امتحان",
      "سوال بپرس",
      "تست",
    ],
    explain: [
      "explain",
      "i don't understand",
      "what does",
      "what is",
      "how does",
      "why is",
      "can you clarify",
      "break it down",
      "simpler",
      "easier words",
      "توضیح بده",
      "نمی‌فهمم",
      "چیست",
      "ساده‌تر",
    ],
    vocabulary: [
      "vocabulary",
      "new words",
      "word list",
      "teach me words",
      "what does this word mean",
      "translate",
      "لغت",
      "کلمه",
      "واژه",
      "ترجمه",
    ],
    prepare: [
      "prepare for class",
      "prepare for tomorrow",
      "what should i review",
      "get ready for",
      "before my class",
      "upcoming class",
      "آماده شوم",
      "آمادگی",
      "مرور کنم",
    ],
    study: [], // default fallback
  };

  for (const [mode, keywords] of Object.entries(patterns)) {
    if (mode === "study") continue;
    if (keywords.some((kw) => q.includes(kw))) {
      return mode as AiMode;
    }
  }

  return "study";
}

/**
 * Extract topic keywords from questions.
 * Simple frequency-based extraction, not NLP.
 */
export function extractTopics(questions: string[]): string[] {
  const stopWords = new Set([
    "what",
    "is",
    "the",
    "how",
    "does",
    "can",
    "you",
    "explain",
    "me",
    "my",
    "i",
    "a",
    "an",
    "in",
    "of",
    "to",
    "for",
    "from",
    "about",
    "this",
    "that",
    "it",
    "do",
    "please",
    "help",
    "with",
    "and",
    "or",
    "but",
    "not",
    "are",
    "was",
    "were",
    "be",
    "have",
    "has",
    "had",
    "will",
    "would",
    "could",
    "should",
    "چیست",
    "است",
    "چطور",
    "من",
    "را",
    "در",
    "از",
    "به",
    "که",
  ]);

  const counts = new Map<string, number>();
  for (const q of questions) {
    const words = q
      .toLowerCase()
      .replace(/[؟?!.,،;:'"]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));
    for (const w of words) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([topic]) => topic);
}

/**
 * Estimate language level from question complexity.
 */
function estimateLanguageLevel(questions: string[]): string {
  if (questions.length < 3) return "beginner";

  // Filter to English questions
  const englishQuestions = questions.filter((q) => {
    const dariChars = (q.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = q.replace(/\s/g, "").length;
    return totalChars > 0 && dariChars / totalChars < 0.3;
  });

  if (englishQuestions.length < 3) return "beginner";

  const avgWordCount =
    englishQuestions.reduce((sum, q) => sum + q.split(/\s+/).length, 0) / englishQuestions.length;
  const allWords = englishQuestions.join(" ").toLowerCase().split(/\s+/);
  const uniqueWords = new Set(allWords).size;
  const diversity = uniqueWords / allWords.length;

  if (avgWordCount > 12 && diversity > 0.6) return "intermediate";
  if (avgWordCount > 7 && diversity > 0.4) return "elementary";
  return "beginner";
}
