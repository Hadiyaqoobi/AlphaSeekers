-- Registration cutoff for a class: the last moment a student may request to join.
-- Nullable with no default, so every existing class keeps its current behaviour
-- (open indefinitely) and no backfill is needed.
ALTER TABLE "Class" ADD COLUMN "registrationDeadline" TIMESTAMP(3);

-- The public landing query filters on (status, published, registrationDeadline)
-- to hide classes whose registration has closed.
CREATE INDEX "Class_registrationDeadline_idx" ON "Class"("registrationDeadline");
