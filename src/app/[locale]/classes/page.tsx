import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EnrollButton } from "@/components/classes/enroll-button";
import { formatDateTime } from "@/lib/format-date";
import { isStudentEnrolledInClass, listClasses } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type ClassesPageProps = {
  params: { locale: string };
  searchParams: { page?: string; search?: string };
};

const PAGE_SIZE = 10;

const BORDER_COLORS = [
  "border-t-emerald-500",
  "border-t-teal-500",
  "border-t-sky-500",
  "border-t-amber-500",
] as const;

const AVATAR_GRADIENTS = [
  "from-neon-500 to-teal-600",
  "from-teal-500 to-cyan-600",
  "from-sky-500 to-blue-600",
  "from-amber-500 to-orange-600",
] as const;

export default async function ClassesPage({ params, searchParams }: ClassesPageProps) {
  const { locale } = params;
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (!user.approved && user.role !== "ADMIN") {
    redirect(`/${locale}/pending-approval`);
  }

  const t = await getTranslations({ locale, namespace: "classes" });

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const search = searchParams.search ?? "";

  const result = await listClasses({
    page,
    limit: PAGE_SIZE,
    search,
  });

  const enrolledSet = new Set<string>();
  if (user.role === "STUDENT") {
    const checks = await Promise.all(
      result.items.map(async (item) => ({
        id: item.id,
        enrolled: await isStudentEnrolledInClass(user.id, item.id),
      })),
    );
    for (const c of checks) {
      if (c.enrolled) enrolledSet.add(c.id);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-main sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-base text-ink-soft">{t("subtitle")}</p>
        </div>

        <form className="flex gap-2 sm:min-w-[320px]" method="GET">
          <div className="relative flex-1">
            {/* Search icon */}
            <svg
              className="pointer-events-none absolute inset-y-0 left-3 h-full w-4 text-ink-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              className="field !pl-9"
              defaultValue={search}
              name="search"
              placeholder={t("searchPlaceholder")}
            />
          </div>
          <button className="btn-primary" type="submit">
            {t("searchButton")}
          </button>
        </form>
      </header>

      {/* Class Cards */}
      {result.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-DEFAULT bg-dark-100/60 px-6 py-16 text-center">
          {/* Empty-state illustration icon */}
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200">
            <svg
              className="h-10 w-10 text-ink-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink-soft">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {result.items.map((item, index) => {
            const colorIndex = index % 4;
            const borderColor = BORDER_COLORS[colorIndex];
            const avatarGradient = AVATAR_GRADIENTS[colorIndex];
            const teacherInitial = item.teacherName?.charAt(0)?.toUpperCase() ?? "T";

            return (
              <article
                className={`group relative overflow-hidden rounded-2xl border border-line-DEFAULT border-t-4 ${borderColor} bg-dark-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
                key={item.id}
              >
                <div className="p-5 sm:p-6">
                  {/* Teacher Row */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} text-sm font-bold text-white shadow-sm`}
                    >
                      {teacherInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold text-ink-main group-hover:text-teal-700 transition-colors">
                        {item.name}
                      </h2>
                      <p className="truncate text-sm text-ink-soft">{item.teacherName}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-4 space-y-2.5">
                    {/* Schedule */}
                    <div className="flex items-center gap-2 text-sm text-ink-soft">
                      <svg
                        className="h-4 w-4 flex-shrink-0 text-ink-faint"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">{item.schedule}</span>
                    </div>

                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Language Badge */}
                      <span className="inline-flex items-center gap-1 rounded-full bg-dark-100 px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495A18.023 18.023 0 0 1 3.75 7.488"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {item.language}
                      </span>

                      {/* Enrollment pill */}
                      <span className="inline-flex items-center gap-1 rounded-full bg-neon-50 px-2.5 py-0.5 text-xs font-semibold text-neon-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {item.enrolledCount} {t("enrolled")}
                      </span>

                      {/* Duration badge */}
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                        {item.durationMinutes} {t("minutesShort")}
                      </span>

                      {/* Category */}
                      <span className="badge-pill">{item.subjectCategory}</span>
                    </div>
                  </div>

                  {/* Next Session */}
                  <p className="mt-3 text-xs text-ink-faint">
                    {item.nextSessionStart
                      ? formatDateTime(item.nextSessionStart, locale)
                      : t("sessionPending")}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 border-t border-line-soft bg-dark-50/50 px-5 py-3 sm:px-6">
                  <Link
                    className="btn-secondary !min-h-[2.25rem] !px-4 !text-xs"
                    href={`/${locale}/classes/${item.id}`}
                  >
                    {t("details")}
                  </Link>
                  {user?.role === "STUDENT" ? (
                    <EnrollButton classId={item.id} initiallyEnrolled={enrolledSet.has(item.id)} />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {result.pagination.totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-3 pt-2">
          <Link
            aria-disabled={result.pagination.page <= 1}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-DEFAULT bg-dark-100 px-5 text-sm font-semibold text-ink-main shadow-sm transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            href={`/${locale}/classes?page=${Math.max(1, result.pagination.page - 1)}&search=${encodeURIComponent(search)}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("prev")}
          </Link>

          <span className="inline-flex h-10 items-center rounded-full bg-dark-100 px-4 text-sm font-medium text-ink-soft shadow-sm ring-1 ring-line-DEFAULT">
            {result.pagination.page} / {result.pagination.totalPages}
          </span>

          <Link
            aria-disabled={result.pagination.page >= result.pagination.totalPages}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-DEFAULT bg-dark-100 px-5 text-sm font-semibold text-ink-main shadow-sm transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            href={`/${locale}/classes?page=${Math.min(result.pagination.totalPages, result.pagination.page + 1)}&search=${encodeURIComponent(search)}`}
          >
            {t("next")}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
