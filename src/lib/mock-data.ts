export type ClassPreview = {
  id: string;
  name: string;
  subjectCategory: string;
  teacherName: string;
  schedule: string;
  language: string;
  enrolledCount: number;
};

export const classCatalog: ClassPreview[] = [
  {
    id: "1",
    name: "English Fundamentals",
    subjectCategory: "Languages",
    teacherName: "Mariam",
    schedule: "Tue, Thu 6:00 PM",
    language: "English",
    enrolledCount: 42,
  },
  {
    id: "2",
    name: "Korean Starter",
    subjectCategory: "Languages",
    teacherName: "Sahar",
    schedule: "Mon, Wed 7:00 PM",
    language: "Korean",
    enrolledCount: 30,
  },
  {
    id: "3",
    name: "Chinese Basics",
    subjectCategory: "Languages",
    teacherName: "Nilofar",
    schedule: "Sat 4:00 PM",
    language: "Chinese",
    enrolledCount: 26,
  },
  {
    id: "4",
    name: "Spanish Conversation",
    subjectCategory: "Languages",
    teacherName: "Lina",
    schedule: "Sun 5:00 PM",
    language: "Spanish",
    enrolledCount: 19,
  },
  {
    id: "5",
    name: "Arabic Reading",
    subjectCategory: "Languages",
    teacherName: "Farzana",
    schedule: "Tue 5:00 PM",
    language: "Arabic",
    enrolledCount: 37,
  },
  {
    id: "6",
    name: "German A1",
    subjectCategory: "Languages",
    teacherName: "Ariana",
    schedule: "Thu 4:00 PM",
    language: "German",
    enrolledCount: 22,
  },
  {
    id: "7",
    name: "Anatomy Essentials",
    subjectCategory: "Professional Skills",
    teacherName: "Dr. Laila",
    schedule: "Mon 6:00 PM",
    language: "Dari",
    enrolledCount: 34,
  },
  {
    id: "8",
    name: "Journalism Basics",
    subjectCategory: "Professional Skills",
    teacherName: "Asma",
    schedule: "Wed 3:00 PM",
    language: "Dari",
    enrolledCount: 28,
  },
  {
    id: "9",
    name: "Creative Writing",
    subjectCategory: "Professional Skills",
    teacherName: "Roya",
    schedule: "Fri 3:00 PM",
    language: "Dari",
    enrolledCount: 39,
  },
  {
    id: "10",
    name: "Public Speaking",
    subjectCategory: "Professional Skills",
    teacherName: "Amina",
    schedule: "Sat 2:00 PM",
    language: "Dari",
    enrolledCount: 24,
  },
  {
    id: "11",
    name: "Painting Workshop",
    subjectCategory: "Arts",
    teacherName: "Sadaf",
    schedule: "Sun 1:00 PM",
    language: "Dari",
    enrolledCount: 33,
  },
  {
    id: "12",
    name: "Handwriting Mastery",
    subjectCategory: "Arts",
    teacherName: "Maryam",
    schedule: "Thu 2:00 PM",
    language: "Dari",
    enrolledCount: 41,
  },
  {
    id: "13",
    name: "Photoshop Fundamentals",
    subjectCategory: "Professional Skills",
    teacherName: "Parisa",
    schedule: "Mon 8:00 PM",
    language: "English",
    enrolledCount: 27,
  },
  {
    id: "14",
    name: "Digital Research Skills",
    subjectCategory: "Professional Skills",
    teacherName: "Mahsa",
    schedule: "Wed 8:00 PM",
    language: "English",
    enrolledCount: 21,
  },
  {
    id: "15",
    name: "Scholarship Application Lab",
    subjectCategory: "Professional Skills",
    teacherName: "Nargis",
    schedule: "Tue 3:00 PM",
    language: "Dari",
    enrolledCount: 31,
  },
];

export const dashboardStats = {
  activeClasses: 28,
  students: 500,
  teachers: 34,
  sessionsToday: 9,
};
