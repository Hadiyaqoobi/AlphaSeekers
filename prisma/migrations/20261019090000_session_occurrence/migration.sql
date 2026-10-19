-- Classes can meet on several days a week, each day booked as its own session.
-- Each auto-booked session remembers the weekly slot it was booked for, so a
-- session staff move or cancel still counts for that day. Additive: one nullable
-- column and one index, existing rows are untouched (null = the old rule).
ALTER TABLE "Session" ADD COLUMN "occurrenceAt" TIMESTAMP(3);

CREATE INDEX "Session_classId_occurrenceAt_idx" ON "Session"("classId", "occurrenceAt");
