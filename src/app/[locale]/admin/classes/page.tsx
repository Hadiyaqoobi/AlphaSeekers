import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { ArchiveClassButton } from "@/components/admin/archive-class-button";
import { AdminClassForm } from "@/components/forms/admin-class-form";
import { RunRemindersButton } from "@/components/forms/run-reminders-button";
import { RunSchedulerButton } from "@/components/forms/run-scheduler-button";
import { listAdminClasses, listUsersByRole } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type AdminClassesPageProps = {
  params: { locale: string };
};

export default async function AdminClassesPage({ params }: AdminClassesPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(`/${params.locale}/login`);
  }

  if (user.role !== "ADMIN") {
    redirect(`/${params.locale}/dashboard`);
  }

  const t = await getTranslations({ locale: params.locale, namespace: "admin" });
  const teachers = await listUsersByRole("TEACHER");
  const classes = await listAdminClasses({ page: 1, limit: 10 });

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <p className="section-kicker">{t("title")}</p>
        <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("controlPanel")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("controlPanelSubtitle")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/${params.locale}/admin/users`}>
            {t("userApprovals")}
          </Link>
          <Link className="btn-secondary" href={`/${params.locale}/admin/teachers`}>
            {t("teachers")}
          </Link>
          <Link className="btn-secondary" href={`/${params.locale}/admin/content`}>
            {t("content")}
          </Link>
          <Link className="btn-secondary" href={`/${params.locale}/admin/analytics`}>
            {t("analytics")}
          </Link>
          <Link className="btn-secondary" href={`/${params.locale}/dashboard`}>
            {t("dashboard")}
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminClassForm teachers={teachers} />
        <RunSchedulerButton />
        <RunRemindersButton />
      </div>

      <section className="panel panel-strong p-4">
        <h2 className="text-lg font-black text-slate-900">{t("recentClasses")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 font-semibold" scope="col">{t("name")}</th>
                <th className="py-2 font-semibold" scope="col">{t("teacher")}</th>
                <th className="py-2 font-semibold" scope="col">{t("schedule")}</th>
                <th className="py-2 font-semibold" scope="col">{t("duration")}</th>
                <th className="py-2 font-semibold" scope="col">{t("enrolled")}</th>
                <th className="py-2 font-semibold" scope="col">{t("status")}</th>
                <th className="py-2 text-right font-semibold" scope="col">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {classes.items.map((item) => (
                <tr className="border-b border-slate-100 text-slate-700" key={item.id}>
                  <td className="py-2 font-semibold text-slate-900">{item.name}</td>
                  <td className="py-2">{item.teacherName}</td>
                  <td className="py-2">{item.schedulePreference}</td>
                  <td className="py-2">{item.durationMinutes} {t("min")}</td>
                  <td className="py-2">{item.enrolledCount}</td>
                  <td className="py-2">{item.status}</td>
                  <td className="py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link className="btn-secondary" href={`/${params.locale}/admin/classes/${item.id}`}>
                        {t("view")}
                      </Link>
                      {item.status === "ARCHIVED" ? null : <ArchiveClassButton classId={item.id} />}
                    </div>
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
