-- Instructor-managed scheduling.
-- Adds a per-class scheduling mode (AUTO keeps today's behavior) and a
-- per-session confirmation timestamp. Additive; IF NOT EXISTS keeps it safe.

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SchedulingMode') THEN
        CREATE TYPE "SchedulingMode" AS ENUM ('AUTO', 'MANUAL');
    END IF;
END$$;

-- AlterTable: Class.schedulingMode (default AUTO so existing classes are unchanged)
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "schedulingMode" "SchedulingMode" NOT NULL DEFAULT 'AUTO';

-- AlterTable: Session.confirmedAt (null = auto-proposed, set = instructor-confirmed)
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
