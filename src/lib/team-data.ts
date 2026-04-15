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
    role: "CEO & Founder",
    roleDari: "مدیر عمومی و بنیانگذار",
    photo: "/team/sahar.jpg",
    bio: "Sahar founded AlphaSeekers with a belief that no government policy should determine whether a student gets to learn. What started as WhatsApp groups and Google Meet links has grown into a full platform serving students across Afghanistan, powered by volunteer teachers from around the world.",
    bioDari:
      "سحر آلفاسیکرز را با این باور تأسیس کرد که هیچ سیاست دولتی نباید تعیین کند که آیا یک شاگرد می‌تواند درس بخواند یا نه. آنچه با گروه‌های واتساپ و لینک‌های Google Meet شروع شد، به یک پلتفرم کامل تبدیل شده که به شاگردان در سراسر افغانستان خدمت می‌کند.",
    order: 1,
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
    order: 2,
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
    order: 3,
  },
  {
    id: "shahla",
    name: "Shahla Jalili",
    nameDari: "شهلا جلیلی",
    role: "Marketing & Design Manager",
    roleDari: "مدیر بازاریابی و دیزاین",
    photo: "/team/shahla.png",
    bio: "Shapes how AlphaSeekers presents itself to the world — from our visual identity to outreach and communications.",
    bioDari:
      "نحوه ارائه آلفاسیکرز به جهان را شکل می‌دهد — از هویت بصری تا ارتباطات و تبلیغات.",
    order: 4,
  },
  {
    id: "farkhunda",
    name: "Farkhunda Latif",
    nameDari: "فرخنده لطیف",
    role: "IT Manager",
    roleDari: "مدیر تکنالوژی معلوماتی",
    photo: null, // TODO: Add photo when available
    bio: "Oversees our technology infrastructure, keeping the platform running smoothly for students on every device and connection.",
    bioDari:
      "زیرساخت تکنالوژی ما را نظارت می‌کند و اطمینان حاصل می‌کند که پلتفرم بر روی هر دستگاه و اتصالی به درستی کار کند.",
    order: 5,
  },
];
