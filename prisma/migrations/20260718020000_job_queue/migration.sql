-- Background job queue (automation backbone).
-- Additive; IF NOT EXISTS keeps re-application safe.

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobStatus') THEN
        CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'DEAD');
    END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "dedupeKey" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- Idempotency: a logical job may be enqueued at most once while live.
CREATE UNIQUE INDEX IF NOT EXISTS "Job_dedupeKey_key" ON "Job"("dedupeKey");

-- Claim query: due work ordered by (priority desc, runAt asc), filtered on status.
CREATE INDEX IF NOT EXISTS "Job_status_runAt_priority_idx" ON "Job"("status", "runAt", "priority");
CREATE INDEX IF NOT EXISTS "Job_type_status_idx" ON "Job"("type", "status");
