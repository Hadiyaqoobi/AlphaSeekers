import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { ArchiveClassButton } from "@/components/admin/archive-class-button";
import { ClassCreateForm } from "@/components/staff/staff-class-form";
import { RunRemindersButton } from "@/components/forms/run-reminders-button";
import { RunSchedulerButton } from "@/components/forms/run-scheduler-button";
import { getAdminClassStats, listAdminClasses, listUsersByRole } from "@/lib/platform/store";
import { getAccessControl, can, isSuper } from "@/lib/security/permissions";

type AdminClassesPageProps = {
  params: { locale: string };
  searchParams?: { page?: string; status?: string };
};

const STATUS_FILTERS = ["all", "active", "archived"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default async function AdminClassesPage({ params, searchParams }: AdminClassesPageProps) {
  const access = await getAccessControl();

  if (!access) {
    redirect(`/${params.locale}/login`);
  }

  if (!can(access, "classes.view")) {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "admin" });
  const tl = await getTranslations({ locale: params.locale, namespace: "classLifecycle" });
  const teachers = await listUsersByRole("TEACHER");
  // Paged, with an Active/Archived filter: this used to show only the 10 newest
  // classes with no way to reach the rest (or to find an archived one).
  const statusFilter: StatusFilter = STATUS_FILTERS.includes(searchParams?.status as StatusFilter)
    ? (searchParams?.status as StatusFilter)
    : "all";
  const requestedPage = Math.max(1, Number.parseInt(searchParams?.page ?? "1", 10) || 1);
  const classes = await listAdminClasses({
    page: requestedPage,
    limit: 20,
    ...(statusFilter === "active" ? { status: "ACTIVE" as const } : {}),
    ...(statusFilter === "archived" ? { status: "ARCHIVED" as const } : {}),
  });
  const classStats = await getAdminClassStats();
  const listHref = (page: number, status: StatusFilter) =>
    `/${params.locale}/admin/classes?${new URLSearchParams({
      ...(status !== "all" ? { status } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    }).toString()}`;
  const filterLabel: Record<StatusFilter, string> = {
    all: tl("filterAll"),
    active: tl("filterActive"),
    archived: tl("filterArchived"),
  };

  const totalClasses = classStats.total;
  const activeClasses = classStats.active;
  const archivedClasses = classStats.archived;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      {/* Page Header */}
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neon-400">
          {t("title")}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-main">
          {t("controlPanel")}
        </h1>
        <p className="mt-2 text-base text-ink-soft">{t("controlPanelSubtitle")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/admin/users`}
          >
            {t("userApprovals")}
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/admin/teachers`}
          >
            {t("teachers")}
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/admin/content`}
          >
            {t("content")}
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/admin/analytics`}
          >
            {t("analytics")}
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            href={`/${params.locale}/dashboard`}
          >
            {t("dashboard")}
          </Link>
        </div>
      </header>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-dark-100 p-6">
          <p className="text-sm font-medium text-ink-soft">Total Classes</p>
          <p className="mt-2 text-3xl font-bold text-ink-main">{totalClasses}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-dark-100 p-6">
          <p className="text-sm font-medium text-ink-soft">Active</p>
          <p className="mt-2 text-3xl font-bold text-neon-400">{activeClasses}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-dark-100 p-6">
          <p className="text-sm font-medium text-ink-soft">Archived</p>
          <p className="mt-2 text-3xl font-bold text-ink-faint">{archivedClasses}</p>
        </div>
      </div>

      {/* Action Cards */}
      {/* The class form gets two of the three columns: squeezed into one, its
          day / time / length row clipped the time to "06:C". */}
      <div className="mb-8 grid gap-5 lg:grid-cols-3">
        <div className={isSuper(access) ? "lg:col-span-2" : "lg:col-span-3"}>
          <ClassCreateForm autosaveKey="admin-class-create" teachers={teachers} />
        </div>
        {/* Manual cron runs require a live super admin; anyone else got a 401. */}
        {isSuper(access) ? (
          <div className="flex flex-col gap-5">
            <RunSchedulerButton />
            <RunRemindersButton />
          </div>
        ) : null}
      </div>

      {/* Classes Table */}
      <section className="rounded-2xl border border-white/5 bg-dark-100">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-5">
          <h2 className="text-lg font-bold text-ink-main">{t("recentClasses")}</h2>
          <nav className="flex gap-2">
            {STATUS_FILTERS.map((status) => (
              <Link
                aria-current={status === statusFilter ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  status === statusFilter ? "bg-neon-500 text-black" : "bg-white/5 text-ink-soft hover:bg-white/10"
                }`}
                href={listHref(1, status)}
                key={status}
              >
                {filterLabel[status]}
              </Link>
            ))}
          </nav>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="bg-white/5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                <th className="px-6 py-4" scope="col">{t("name")}</th>
                <th className="px-6 py-4" scope="col">{t("teacher")}</th>
                <th className="px-6 py-4" scope="col">{t("schedule")}</th>
                <th className="px-6 py-4" scope="col">{t("duration")}</th>
                <th className="px-6 py-4" scope="col">{t("enrolled")}</th>
                <th className="px-6 py-4" scope="col">{t("status")}</th>
                <th className="px-6 py-4 text-right" scope="col">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {classes.items.map((item) => (
                <tr
                  className="transition-colors hover:bg-white/5"
                  key={item.id}
                >
                  <td className="px-6 py-4 font-semibold text-ink-main">{item.name}</td>
                  <td className="px-6 py-4 text-ink-soft">{item.teacherName}</td>
                  <td className="px-6 py-4 text-ink-soft">{item.schedulePreference}</td>
                  <td className="px-6 py-4 text-ink-soft">
                    {item.durationMinutes} {t("min")}
                  </td>
                  <td className="px-6 py-4 text-ink-soft">{item.enrolledCount}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === "ACTIVE"
                          ? "bg-neon-500/10 text-neon-300 border border-neon-500/20"
                          : "bg-white/5 text-ink-soft"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        className="inline-flex items-center rounded-lg border border-white/10 bg-dark-100 px-4 py-2 text-xs font-semibold text-ink-main transition hover:bg-white/5"
                        href={`/${params.locale}/admin/classes/${item.id}`}
                      >
                        {t("view")}
                      </Link>
                      {item.status === "ARCHIVED" ? null : (
                        <ArchiveClassButton classId={item.id} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {classes.items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                className="mx-auto h-12 w-12 text-ink-faint"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-4 text-sm font-medium text-ink-soft">
                No classes found. Create your first class above.
              </p>
            </div>
          )}
        </div>
        {classes.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/5 px-6 py-4 text-sm">
            {classes.pagination.page > 1 ? (
              <Link className="btn-secondary" href={listHref(classes.pagination.page - 1, statusFilter)}>
                {tl("prevPage")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-ink-soft">
              {tl("pageOf", { page: classes.pagination.page, total: classes.pagination.totalPages })}
            </span>
            {classes.pagination.page < classes.pagination.totalPages ? (
              <Link className="btn-secondary" href={listHref(classes.pagination.page + 1, statusFilter)}>
                {tl("nextPage")}
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </section>
    </section>
  );
}
