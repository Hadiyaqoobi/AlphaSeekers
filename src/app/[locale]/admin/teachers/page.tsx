import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { formatDateTime } from "@/lib/format-date";
import { listUsersByRole, listTeacherClasses, listTeacherAvailability } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type AdminTeachersPageProps = {
  params: { locale: string };
};

export default async function AdminTeachersPage({ params }: AdminTeachersPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${params.locale}/login`);
  }

  if (user.role !== "ADMIN") {
    redirect(`/${params.locale}/dashboard`);
  }

  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "adminTeachers" });
  const teachers = await listUsersByRole("TEACHER");

  const teacherDetails = await Promise.all(
    teachers.map(async (teacher) => {
      const classes = await listTeacherClasses(teacher.id);
      const availability = await listTeacherAvailability(teacher.id);
      return {
        ...teacher,
        classCount: classes.length,
        totalStudents: classes.reduce((sum, c) => sum + c.enrolledCount, 0),
        hasAvailability: availability.length > 0,
        availabilitySlots: availability.length,
      };
    }),
  );

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("kicker")}</p>
        <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("subtitle")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${params.locale}/admin/classes`}>
            {t("backToAdmin")}
          </Link>
        </div>
      </header>

      <div className="grid gap-px bg-slate-200 rounded-lg overflow-hidden sm:grid-cols-3">
        <article className="bg-white p-4">
          <p className="text-sm text-slate-500">{t("stats.total")}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{teachers.length}</p>
        </article>
        <article className="bg-white p-4">
          <p className="text-sm text-slate-500">{t("stats.withAvailability")}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {teacherDetails.filter((t) => t.hasAvailability).length}
          </p>
        </article>
        <article className="bg-white p-4">
          <p className="text-sm text-slate-500">{t("stats.noAvailability")}</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {teacherDetails.filter((t) => !t.hasAvailability).length}
          </p>
        </article>
      </div>

      {teacherDetails.filter((t) => !t.hasAvailability).length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">{t("needsSetup")}</h2>
          <p className="mt-1 text-sm text-amber-800">{t("needsSetupDesc")}</p>
          <div className="mt-3 space-y-2">
            {teacherDetails
              .filter((t) => !t.hasAvailability)
              .map((teacher) => (
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2" key={teacher.id}>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{teacher.name}</p>
                    <p className="text-xs text-slate-500">{teacher.email}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {t("pendingSetup")}
                  </span>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <section className="panel panel-strong p-4 sm:p-5">
        <h2 className="text-lg font-black text-slate-900">{t("allTeachers")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
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
                <tr className="border-b border-slate-100 text-slate-700" key={teacher.id}>
                  <td className="py-2 font-semibold text-slate-900">{teacher.name}</td>
                  <td className="py-2">{teacher.email}</td>
                  <td className="py-2">{teacher.classCount}</td>
                  <td className="py-2">{teacher.totalStudents}</td>
                  <td className="py-2">
                    {teacher.hasAvailability ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        {teacher.availabilitySlots} {t("slots")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {t("notSet")}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {teacher.approvedAt ? (
                      <span className="text-xs text-emerald-700">{formatDateTime(teacher.approvedAt, locale)}</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
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
