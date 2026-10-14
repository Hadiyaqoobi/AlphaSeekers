-- ADR-0009: per-class sign-up questions and the answers given when joining.
-- Additive and nullable: existing classes have no questions, existing
-- enrolments have no answers, and nothing reads either until a class sets them.
ALTER TABLE "Class" ADD COLUMN "joinQuestions" JSONB;
ALTER TABLE "Enrollment" ADD COLUMN "answers" JSONB;
