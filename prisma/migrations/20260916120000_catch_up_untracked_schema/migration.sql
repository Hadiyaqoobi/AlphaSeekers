-- Catch-up migration: bring the migration history in line with schema.prisma.
--
-- 11 tables and 4 columns were declared in schema.prisma but created by NO
-- migration — they reached production through `prisma db push`, which applies a
-- schema without recording a migration. The consequence is that ANY database
-- built from `prisma migrate deploy` alone (CI, a new environment, a disaster
-- recovery rebuild) came up missing the tables behind student posts, homework,
-- learning paths, session check-in codes and AI safety logging. 14 integration
-- tests fail on such a database with "The column Session.checkinCode does not
-- exist".
--
-- Every statement is IF NOT EXISTS, because production ALREADY has all of this.
-- Applying it there is a no-op that simply records the migration as applied;
-- applying it to a fresh database creates what was missing.
--
-- DELIBERATELY OMITTED: the diff that produced this also wanted to
--   DROP INDEX "DocumentChunk_embedding_idx";
--   ALTER TABLE "DocumentChunk" DROP COLUMN "embedding";
-- Prisma cannot model pgvector's `vector` type, so every diff proposes dropping
-- it. The 20260413 migration created that column in raw SQL for this exact
-- reason. Dropping it would destroy the RAG embeddings. Any future catch-up
-- must strip those two statements again.

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "checkinAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "checkinVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "checkinCode" TEXT,
ADD COLUMN IF NOT EXISTS "checkinCodeExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AISafetyLog" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "safetyPassed" BOOLEAN NOT NULL,
    "safetyCategory" TEXT,
    "safetyAction" TEXT NOT NULL,
    "guardrailViolations" TEXT,
    "blockedResponse" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AISafetyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AIEvaluation" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "pedagogy" DOUBLE PRECISION NOT NULL,
    "safety" DOUBLE PRECISION NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "overall" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT,
    "suggestions" TEXT,
    "humanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "humanAccuracy" DOUBLE PRECISION,
    "humanPedagogy" DOUBLE PRECISION,
    "humanSafety" DOUBLE PRECISION,
    "humanCompleteness" DOUBLE PRECISION,
    "humanOverall" DOUBLE PRECISION,
    "humanNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "promptVariant" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LearningPath" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "lessons" JSONB NOT NULL,
    "currentLesson" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LessonProgress" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "lessonNumber" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "content" JSONB,
    "quizScore" DOUBLE PRECISION,
    "quizAnswers" JSONB,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SessionSummary" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentDari" TEXT,
    "quizData" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SessionNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HomeworkAssignment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "imageUrl" TEXT,
    "aiReview" TEXT,
    "teacherGrade" TEXT,
    "teacherNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudentPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleDari" TEXT,
    "slug" TEXT NOT NULL,
    "content" TEXT,
    "contentDari" TEXT,
    "excerpt" TEXT,
    "excerptDari" TEXT,
    "coverImageUrl" TEXT,
    "galleryUrls" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT,
    "tags" TEXT,
    "readTimeMin" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SpacedRepetitionItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "context" TEXT,
    "classId" TEXT,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpacedRepetitionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AISafetyLog_safetyAction_createdAt_idx" ON "AISafetyLog"("safetyAction", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AISafetyLog_confidenceLevel_createdAt_idx" ON "AISafetyLog"("confidenceLevel", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AIEvaluation_interactionId_key" ON "AIEvaluation"("interactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AIEvaluation_overall_createdAt_idx" ON "AIEvaluation"("overall", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AIEvaluation_promptVariant_createdAt_idx" ON "AIEvaluation"("promptVariant", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LearningPath_userId_status_idx" ON "LearningPath"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LessonProgress_userId_completed_idx" ON "LessonProgress"("userId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LessonProgress_pathId_lessonNumber_key" ON "LessonProgress"("pathId", "lessonNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SessionSummary_sessionId_key" ON "SessionSummary"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SessionNote_studentId_idx" ON "SessionNote"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SessionNote_sessionId_studentId_key" ON "SessionNote"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HomeworkAssignment_classId_dueDate_idx" ON "HomeworkAssignment"("classId", "dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkSubmission_assignmentId_studentId_key" ON "HomeworkSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StudentPost_slug_key" ON "StudentPost"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentPost_status_publishedAt_idx" ON "StudentPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentPost_type_status_idx" ON "StudentPost"("type", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentPost_authorId_status_idx" ON "StudentPost"("authorId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudentPost_featured_publishedAt_idx" ON "StudentPost"("featured", "publishedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostLike_userId_idx" ON "PostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SpacedRepetitionItem_userId_nextReviewAt_idx" ON "SpacedRepetitionItem"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SpacedRepetitionItem_userId_classId_idx" ON "SpacedRepetitionItem"("userId", "classId");

-- AddForeignKey
ALTER TABLE "AIEvaluation" ADD CONSTRAINT "AIEvaluation_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "AIInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSummary" ADD CONSTRAINT "SessionSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPost" ADD CONSTRAINT "StudentPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "StudentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

