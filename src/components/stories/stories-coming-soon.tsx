import Link from "next/link";

interface StoriesComingSoonProps {
  locale: string;
}

export function StoriesComingSoon({ locale }: StoriesComingSoonProps) {
  const isDari = locale === "fa";

  return (
    <>
      {/* Hero */}
      <section className="relative bg-land-dark overflow-hidden">
        <div
          className="absolute blur-[120px] rounded-full opacity-20"
          style={{
            width: 400,
            height: 400,
            top: "40%",
            left: "60%",
            background: "radial-gradient(circle, rgba(29,185,100,0.12) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-24 lg:py-32 text-center">
          <p className="text-land-green-400 text-sm font-semibold uppercase tracking-[0.15em] mb-4">
            {isDari ? "صداهای شاگردان" : "Student Voices"}
          </p>
          <h1
            className="text-4xl lg:text-5xl font-bold text-white tracking-tight"
            style={{
              fontFamily: "var(--font-landing), var(--font-display-latin), sans-serif",
            }}
          >
            {isDari ? "به زودی" : "Coming soon"}
          </h1>
          <p className="text-lg text-white/55 max-w-2xl mx-auto mt-6 leading-relaxed">
            {isDari
              ? "فضایی برای شاگردان افغان تا داستان‌ها، هنر و شعرهای خود را با جهان به اشتراک بگذارند."
              : "A space for Afghan students to share their stories, artwork, and poetry with the world."}
          </p>
        </div>
      </section>

      {/* Feature preview */}
      <section className="bg-[var(--bg-base)] py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "📝",
                title: isDari ? "مقالات" : "Articles",
                desc: isDari
                  ? "درباره تجربه یادگیری، آرزوها و چالش‌ها بنویسید"
                  : "Share your learning journey, dreams, and challenges",
              },
              {
                icon: "🎨",
                title: isDari ? "هنر" : "Artwork",
                desc: isDari
                  ? "نقاشی، عکاسی و هنر دیجیتال خود را به نمایش بگذارید"
                  : "Showcase paintings, photography, and digital art",
              },
              {
                icon: "✦",
                title: isDari ? "شعر" : "Poetry",
                desc: isDari
                  ? "سنت ادبی دری را زنده نگه دارید"
                  : "Continue the Dari literary tradition",
              },
              {
                icon: "✨",
                title: isDari ? "معرفی شاگردان" : "Student spotlights",
                desc: isDari
                  ? "خودتان، رشته تحصیلی و رؤیای خود را معرفی کنید"
                  : "Share who you are, what you study, and your dreams",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-dark-100 border border-line p-6 shadow-sm"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-ink-main mb-1">{f.title}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-ink-main mb-3">
              {isDari ? "می‌خواهید اولین نویسنده ما باشید؟" : "Want to be our first writer?"}
            </h2>
            <p className="text-ink-soft mb-6 max-w-md mx-auto">
              {isDari
                ? "ثبت نام کنید و داستان خود را با جهان به اشتراک بگذارید."
                : "Register and share your story with the world."}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center px-6 py-3 rounded-xl bg-land-green-600 text-white font-semibold hover:bg-land-green-700 transition-colors"
              >
                {isDari ? "ثبت نام" : "Register"}
              </Link>
              <Link
                href={`/${locale}/stories/write`}
                className="inline-flex items-center px-6 py-3 rounded-xl border border-line text-ink-main font-semibold hover:bg-dark-50 transition-colors"
              >
                {isDari ? "همین حالا بنویسید" : "Write now"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
