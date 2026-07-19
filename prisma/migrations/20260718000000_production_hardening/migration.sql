-- Production Hardening migration.
--
-- Adds three new tables (RateLimitBucket, ClassAnnouncement, SiteSettings) and a
-- set of covering indexes on hot query columns. This migration is ADDITIVE only.
--
-- IMPORTANT: This project restores the pgvector HNSW index on
-- "DocumentChunk"."embedding" by hand after material-chunk migrations. Do NOT drop
-- or alter any existing vector index here — this file only CREATEs new objects and
-- leaves "DocumentChunk_embedding_idx" untouched.
--
-- Statements use IF NOT EXISTS so re-running (or applying on a DB where a prior
-- hotfix already added an object) is safe.

-- ─── New tables ──────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClassAnnouncement" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassAnnouncement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClassAnnouncement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes for the new tables ──────────────────────────────────────────────

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClassAnnouncement_classId_createdAt_idx" ON "ClassAnnouncement"("classId", "createdAt");

-- ─── Covering indexes on existing hot tables ─────────────────────────────────

-- CreateIndex: Session filtered by class, by time window, and by both.
CREATE INDEX IF NOT EXISTS "Session_classId_idx" ON "Session"("classId");
CREATE INDEX IF NOT EXISTS "Session_startTime_idx" ON "Session"("startTime");
CREATE INDEX IF NOT EXISTS "Session_classId_startTime_idx" ON "Session"("classId", "startTime");

-- CreateIndex: Enrollment counted/listed by class (classId-first; the existing
-- unique on (studentId, classId) does not serve classId-first scans).
CREATE INDEX IF NOT EXISTS "Enrollment_classId_idx" ON "Enrollment"("classId");

-- CreateIndex: Attendance student-centric aggregates (attendance history).
-- (sessionId-first lookups are already served by the unique on (sessionId, studentId).)
CREATE INDEX IF NOT EXISTS "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex: User role-filtered lists/counts and approval-queue filters.
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_approvedAt_idx" ON "User"("approvedAt");

-- CreateIndex: per-user notification feed ordered newest-first.
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
