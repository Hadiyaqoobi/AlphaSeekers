// Catalog categories are separate from the existing subject (used by
// class details, tutoring and reporting).
export const COURSE_CATEGORIES = ["ENGLISH", "TECHNOLOGY", "AI", "OTHER_SKILLS"] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export function parseCourseCategory(value: string | null | undefined): CourseCategory | undefined {
  return COURSE_CATEGORIES.find((category) => category === value);
}
