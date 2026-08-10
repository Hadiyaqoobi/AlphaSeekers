-- Records what an applicant asked to be at signup.
--
-- Registration always creates a STUDENT (privilege-escalation prevention), so
-- without this the teacher/student toggle on the register form had no effect
-- anywhere and the intent was lost. The approvals screen reads this column.
--
-- Expand-phase migration: the column is NULLABLE with no default and nothing
-- writes it until the new build goes live, so it is safe to apply while the
-- currently-running version is still serving traffic.
ALTER TABLE "User" ADD COLUMN "requestedRole" "UserRole";
