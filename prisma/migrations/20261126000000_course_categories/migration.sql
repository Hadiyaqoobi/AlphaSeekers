CREATE TYPE "CourseCategory" AS ENUM ('ENGLISH', 'TECHNOLOGY', 'AI', 'OTHER_SKILLS');
ALTER TABLE "Class" ADD COLUMN "courseCategory" "CourseCategory" NOT NULL DEFAULT 'OTHER_SKILLS';

-- Backfill recognizable courses without rewriting subject or class content.
-- Staff can correct or refine the category from the existing class editor.
UPDATE "Class" SET "courseCategory" = CASE
  WHEN concat_ws(' ', "subjectCategory", "name") ~* '\m(artificial intelligence|AI|machine learning)\M'
       OR concat_ws(' ', "subjectCategory", "name") LIKE '%هوش مصنوعی%' THEN 'AI'::"CourseCategory"
  WHEN concat_ws(' ', "subjectCategory", "name") ~* '\m(English|IELTS|TOEFL)\M'
       OR concat_ws(' ', "subjectCategory", "name") ~ 'انگلیسی|انگليسی' THEN 'ENGLISH'::"CourseCategory"
  WHEN concat_ws(' ', "subjectCategory", "name") ~* '\m(technology|computer|coding|programming|Microsoft (Word|Excel|Office|PowerPoint))\M'
       OR concat_ws(' ', "subjectCategory", "name") ~ 'تکنالوژی|کمپیوتر' THEN 'TECHNOLOGY'::"CourseCategory"
  ELSE 'OTHER_SKILLS'::"CourseCategory"
END;

CREATE INDEX "Class_courseCategory_status_published_createdAt_idx"
ON "Class"("courseCategory", "status", "published", "createdAt");
