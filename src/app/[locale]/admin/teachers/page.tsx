import Link from "next/link";
import { redirect } from "next/navigation";

import { ClassStatus, EnrollmentStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { formatDateTime } from "@/lib/format-date";
import { listUsersByRole } from "@/lib/platform/store";
import { prisma } from "@/lib/prisma";
import { getAccessControl, can } from "@/lib/security/permissions";

type AdminTeachersPageProps = {
  params: { locale: string };
};

export default async function AdminTeachersPage({ params }: AdminTeachersPageProps) {
  const access = await getAccessControl();

  if (!access) {
    redirect(`/${params.locale}/login`);
  }

  if (!can(access, "users.view")) {
    redirect(`/${params.locale}/dashboard`);
  }

  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "adminTeachers" });
  const teachers = await listUsersByRole("TEACHER");
  const teacherIds = teachers.map((teacher) => teacher.id);

  // Previously this ran two sequential queries per teacher (classes +
  // availability) — an N+1 that scaled with the teacher count. Instead we run
  // two batched aggregate queries over all teachers at once and fold the
  // results in memory. Active classes carry their active-enrollment count so we
  // derive both classCount and totalStudents from a single scan.
  const [teacherClasses, availabilityCounts] = teacherIds.length
    ? await Promise.all([
        prisma.class.findMany({
          where: { teacherId: { in: teacherIds }, status: ClassStatus.ACTIVE },
          select: {
            teacherId: true,
            _count: {
              select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } },
            },
          },
        }),
        prisma.teacherAvailability.groupBy({
          by: ["teacherId"],
          where: { teacherId: { in: teacherIds } },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const classCountMap = new Map<string, number>();
  const studentCountMap = new Map<string, number>();
  for (const klass of teacherClasses) {
    classCountMap.set(klass.teacherId, (classCountMap.get(klass.teacherId) ?? 0) + 1);
    studentCountMap.set(
      klass.teacherId,
      (studentCountMap.get(klass.teacherId) ?? 0) + klass._count.enrollments,
    );
  }

  const availabilityMap = new Map<string, number>();
  for (const row of availabilityCounts) {
    availabilityMap.set(row.teacherId, row._count._all);
  }

  const teacherDetails = teachers.map((teacher) => {
    const availabilitySlots = availabilityMap.get(teacher.id) ?? 0;
    return {
      ...teacher,
      classCount: classCountMap.get(teacher.id) ?? 0,
      totalStudents: studentCountMap.get(teacher.id) ?? 0,
      hasAvailability: availabilitySlots > 0,
      availabilitySlots,
    };
  });

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("kicker")}</p>
        <h1 className="text-3xl font-black text-ink-main sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t("subtitle")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${params.locale}/admin/classes`}>
            {t("backToAdmin")}
          </Link>
        </div>
      </header>

      <div className="grid gap-px bg-dark-200 rounded-lg overflow-hidden sm:grid-cols-3">
        <article className="bg-dark-100 p-4">
          <p className="text-sm text-ink-soft">{t("stats.total")}</p>
          <p className="mt-1 text-2xl font-bold text-ink-main">{teachers.length}</p>
        </article>
        <article className="bg-dark-100 p-4">
          <p className="text-sm text-ink-soft">{t("stats.withAvailability")}</p>
          <p className="mt-1 text-2xl font-bold text-neon-400">
            {teacherDetails.filter((t) => t.hasAvailability).length}
          </p>
        </article>
        <article className="bg-dark-100 p-4">
          <p className="text-sm text-ink-soft">{t("stats.noAvailability")}</p>
          <p className="mt-1 text-2xl font-bold text-red-300">
            {teacherDetails.filter((t) => !t.hasAvailability).length}
          </p>
        </article>
      </div>

      {teacherDetails.filter((t) => !t.hasAvailability).length > 0 ? (
        <section className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
          <h2 className="font-semibold text-amber-200">{t("needsSetup")}</h2>
          <p className="mt-1 text-sm text-amber-300">{t("needsSetupDesc")}</p>
          <div className="mt-3 space-y-2">
            {teacherDetails
              .filter((t) => !t.hasAvailability)
              .map((teacher) => (
                <div className="flex items-center justify-between rounded-lg bg-dark-100 px-3 py-2" key={teacher.id}>
                  <div>
                    <p className="text-sm font-medium text-ink-main">{teacher.name}</p>
                    <p className="text-xs text-ink-soft">{teacher.email}</p>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                    {t("pendingSetup")}
                  </span>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <section className="panel panel-strong p-4 sm:p-5">
        <h2 className="text-lg font-black text-ink-main">{t("allTeachers")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-DEFAULT text-ink-soft">
                <th className="py-2 font-semibold" scope="col">{t("name")}</th>
                <th className="py-2 font-semibold" scope="col">{t("email")}</th>
                <th className="py-2 font-semibold" scope="col">{t("classes")}</th>
                <th className="py-2 font-semibold" scope="col">{t("students")}</th>
                <th className="py-2 font-semibold" scope="col">{t("availability")}</th>
                <th className="py-2 font-semibold" scope="col">{t("approved")}</th>
              </tr>
            </thead>
            <tbody>
              {teacherDetails.map((teacher) => (
                <tr className="border-b border-line-soft text-ink-main" key={teacher.id}>
                  <td className="py-2 font-semibold text-ink-main">{teacher.name}</td>
                  <td className="py-2">{teacher.email}</td>
                  <td className="py-2">{teacher.classCount}</td>
                  <td className="py-2">{teacher.totalStudents}</td>
                  <td className="py-2">
                    {teacher.hasAvailability ? (
                      <span className="rounded-full bg-neon-500/10 px-2 py-0.5 text-xs font-medium text-neon-300">
                        {teacher.availabilitySlots} {t("slots")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
                        {t("notSet")}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {teacher.approvedAt ? (
                      <span className="text-xs text-neon-400">{formatDateTime(teacher.approvedAt, locale)}</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                        {t("pending")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
