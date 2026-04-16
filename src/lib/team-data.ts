// TODO: Sahar to review and approve all bios
// TODO: Native Dari review needed for names and bios

export interface TeamMember {
  id: string;
  name: string;
  nameDari: string;
  role: string;
  roleDari: string;
  photo: string | null;
  bio: string;
  bioDari: string;
  order: number;
}

export const teamMembers: TeamMember[] = [
  {
    id: "sahar",
    name: "Sahar Nikzad",
    nameDari: "سحر نیکزاد",
    role: "Co-Founder & Communication Manager",
    roleDari: "هم‌بنیانگذار و مدیر ارتباطات",
    photo: "/team/sahar.jpg",
    bio: "Sahar co-founded AlphaSeekers with a belief that no government policy should determine whether a student gets to learn. She leads communications strategy, connecting the mission with students, volunteers, and supporters worldwide.",
    bioDari:
      "سحر آلفاسیکرز را با این باور هم‌بنیانگذاری کرد که هیچ سیاست دولتی نباید تعیین کند که آیا یک شاگرد می‌تواند درس بخواند یا نه. او استراتژی ارتباطات را رهبری می‌کند و مأموریت را با شاگردان، داوطلبان و حامیان در سراسر جهان وصل می‌کند.",
    order: 1,
  },
  {
    id: "shahla",
    name: "Shahla Jalili",
    nameDari: "شهلا جلیلی",
    role: "Co-Founder & Marketing Manager",
    roleDari: "هم‌بنیانگذار و مدیر بازاریابی",
    photo: "/team/shahla.png",
    bio: "Shahla co-founded AlphaSeekers and shapes how the organization presents itself to the world — from visual identity and branding to outreach campaigns that amplify the voices of Afghan students.",
    bioDari:
      "شهلا آلفاسیکرز را هم‌بنیانگذاری کرد و نحوه ارائه سازمان به جهان را شکل می‌دهد — از هویت بصری و برندینگ تا کمپین‌های تبلیغاتی که صدای شاگردان افغان را تقویت می‌کند.",
    order: 2,
  },
  {
    id: "farham",
    name: "Mohammad Farham Saighani",
    nameDari: "محمد فرحام صیغانی",
    role: "Educational Coordinator",
    roleDari: "هماهنگ‌کننده آموزشی",
    photo: "/team/mfs.jpeg",
    bio: "Coordinates our educational programs, connecting volunteer teachers with students across 28 weekly classes.",
    bioDari:
      "برنامه‌های آموزشی ما را هماهنگ می‌کند و معلمان داوطلب را با شاگردان در ۲۸ صنف هفتگی وصل می‌کند.",
    order: 3,
  },
  {
    id: "naweed",
    name: "Naweed Dawlat",
    nameDari: "نوید دولت",
    role: "Human Resources Manager",
    roleDari: "مدیر منابع بشری",
    photo: "/team/Naweed.jpeg",
    bio: "Manages our growing team of volunteers, ensuring every teacher and team member has the support they need.",
    bioDari:
      "تیم در حال رشد داوطلبان ما را مدیریت می‌کند و اطمینان حاصل می‌کند که هر معلم و عضو تیم حمایت لازم را دارد.",
    order: 4,
  },
];
