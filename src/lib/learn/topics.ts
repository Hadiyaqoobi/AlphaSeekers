/**
 * Predefined topics for the Self Learning home page.
 * Students can pick from these OR search for any custom topic.
 */

export type SelfLearningTopic = {
  id: string;
  emoji: string;
  name: string;
  nameDari: string;
  description: string;
  suggestedLessons: number;
  category: "languages" | "technology" | "academics" | "skills" | "creative" | "career";
};

export const SELF_LEARNING_TOPICS: SelfLearningTopic[] = [
  {
    id: "english-grammar",
    emoji: "🌐",
    name: "English Grammar",
    nameDari: "گرامر انگلیسی",
    description: "Master English grammar from the basics",
    suggestedLessons: 5,
    category: "languages",
  },
  {
    id: "python-basics",
    emoji: "💻",
    name: "Python Basics",
    nameDari: "اصول پایتون",
    description: "Learn programming from zero",
    suggestedLessons: 6,
    category: "technology",
  },
  {
    id: "math-foundations",
    emoji: "🧮",
    name: "Math Foundations",
    nameDari: "اصول ریاضی",
    description: "Algebra, geometry, and problem solving",
    suggestedLessons: 5,
    category: "academics",
  },
  {
    id: "science-basics",
    emoji: "🔬",
    name: "Science Basics",
    nameDari: "اصول علوم",
    description: "Physics, chemistry, biology fundamentals",
    suggestedLessons: 5,
    category: "academics",
  },
  {
    id: "essay-writing",
    emoji: "📝",
    name: "Essay Writing",
    nameDari: "مقاله نویسی",
    description: "Write clear, structured essays in English",
    suggestedLessons: 4,
    category: "skills",
  },
  {
    id: "design-basics",
    emoji: "🎨",
    name: "Design Basics",
    nameDari: "اصول دیزاین",
    description: "Color, typography, and layout fundamentals",
    suggestedLessons: 4,
    category: "creative",
  },
  {
    id: "resume-interview",
    emoji: "📊",
    name: "Resume & Interview",
    nameDari: "رزومه و مصاحبه",
    description: "Prepare for jobs and scholarships",
    suggestedLessons: 4,
    category: "career",
  },
  {
    id: "world-history",
    emoji: "🌍",
    name: "World History",
    nameDari: "تاریخ جهان",
    description: "Key events that shaped our world",
    suggestedLessons: 5,
    category: "academics",
  },
];

export function findTopicById(id: string): SelfLearningTopic | undefined {
  return SELF_LEARNING_TOPICS.find((t) => t.id === id);
}
