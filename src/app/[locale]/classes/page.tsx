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
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-slate-600">{t("subtitle")}</p>

        <form className="mt-4 flex gap-2" method="GET">
          <input
            className="field min-w-0 flex-1"
            defaultValue={search}
            name="search"
            placeholder={t("searchPlaceholder")}
          />
          <button className="btn-primary" type="submit">
            {t("searchButton")}
          </button>
        </form>
      </header>

      {result.items.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {result.items.map((item) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5" key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="badge-pill">{item.subjectCategory}</span>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.name}</h2>
                  <dl className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="flex gap-1">
                      <dt className="font-medium text-slate-500">{t("teacher")}:</dt>
                      <dd>{item.teacherName}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-medium text-slate-500">{t("schedule")}:</dt>
                      <dd>{item.schedule}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-medium text-slate-500">{t("language")}:</dt>
                      <dd>{item.language}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="font-medium text-slate-500">{t("durationLabel")}:</dt>
                      <dd>{item.durationMinutes} {t("minutesShort")}</dd>
                    </div>
                  </dl>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-900">{item.enrolledCount}</p>
                  <p className="text-xs text-slate-500">{t("enrolled")}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2">
                  <Link className="btn-secondary" href={`/${locale}/classes/${item.id}`}>
                    {t("details")}
                  </Link>
                  {user?.role === "STUDENT" ? <EnrollButton classId={item.id} initiallyEnrolled={enrolledSet.has(item.id)} /> : null}
                </div>
                <p className="text-xs text-slate-500">
                  {item.nextSessionStart
                    ? formatDateTime(item.nextSessionStart, locale)
                    : t("sessionPending")}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {result.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
          <Link
            aria-disabled={result.pagination.page <= 1}
            className="btn-secondary aria-disabled:pointer-events-none aria-disabled:opacity-40"
            href={`/${locale}/classes?page=${Math.max(1, result.pagination.page - 1)}&search=${encodeURIComponent(search)}`}
          >
            {t("prev")}
          </Link>
          <p className="text-sm text-slate-600">
            {result.pagination.page} / {result.pagination.totalPages}
          </p>
          <Link
            aria-disabled={result.pagination.page >= result.pagination.totalPages}
            className="btn-secondary aria-disabled:pointer-events-none aria-disabled:opacity-40"
            href={`/${locale}/classes?page=${Math.min(result.pagination.totalPages, result.pagination.page + 1)}&search=${encodeURIComponent(search)}`}
          >
            {t("next")}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
