import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { listAdminClasses, listUsersByRole } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type StaffDashboardProps = {
    params: { locale: string };
};

export default async function StaffDashboardPage({ params }: StaffDashboardProps) {
    const user = await getSessionUser();

    if (!user) {
        redirect(`/${params.locale}/login`);
    }

    if (user.role !== "ADMIN") {
        redirect(`/${params.locale}/dashboard`);
    }

    const t = await getTranslations({ locale: params.locale, namespace: "staff" });
    const teachers = await listUsersByRole("TEACHER");
    const classes = await listAdminClasses({ page: 1, limit: 10 });
    const students = await listUsersByRole("STUDENT");

    const activeClasses = classes.items.filter(
        (item: { status: string }) => item.status === "ACTIVE",
    );

    return (
        <section className="space-y-4 sm:space-y-5">
            <header className="hero-panel p-5 sm:p-6">
                <p className="section-kicker">{t("title")}</p>
                <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t("dashboard")}</h1>
                <p className="mt-2 text-sm text-slate-600">
                    {t("dashboardSubtitle")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Link className="btn-primary" href={`/${params.locale}/staff/classes/create`}>
                        {t("createClass")}
                    </Link>
                    <Link className="btn-secondary" href={`/${params.locale}/admin/classes`}>
                        {t("adminPanel")}
                    </Link>
                    <Link className="btn-secondary" href={`/${params.locale}/dashboard`}>
                        {t("dashboardLink")}
                    </Link>
                </div>
            </header>

            {/* Quick stats */}
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="panel panel-strong p-4 text-center">
                    <p className="text-3xl font-black text-indigo-600">{activeClasses.length}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{t("activeClasses")}</p>
                </div>
                <div className="panel panel-strong p-4 text-center">
                    <p className="text-3xl font-black text-emerald-600">{teachers.length}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{t("teachers")}</p>
                </div>
                <div className="panel panel-strong p-4 text-center">
                    <p className="text-3xl font-black text-amber-600">{students.length}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{t("students")}</p>
                </div>
            </div>

            {/* Recent classes */}
            <section className="panel panel-strong p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-slate-900">{t("recentClasses")}</h2>
                    <Link className="text-sm font-semibold text-indigo-600 hover:text-indigo-700" href={`/${params.locale}/staff/classes/create`}>
                        {t("newClass")}
                    </Link>
                </div>
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
                            {classes.items.map((item: {
                                id: string;
                                name: string;
                                teacherName: string;
                                schedulePreference: string;
                                durationMinutes: number;
                                enrolledCount: number;
                                status: string;
                            }) => (
                                <tr className="border-b border-slate-100 text-slate-700" key={item.id}>
                                    <td className="py-2 font-semibold text-slate-900">{item.name}</td>
                                    <td className="py-2">{item.teacherName}</td>
                                    <td className="py-2">{item.schedulePreference}</td>
                                    <td className="py-2">{item.durationMinutes} {t("min")}</td>
                                    <td className="py-2">{item.enrolledCount}</td>
                                    <td className="py-2">
                                        <span
                                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === "ACTIVE"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-slate-100 text-slate-500"
                                                }`}
                                        >
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="py-2 text-right">
                                        <Link className="btn-secondary text-xs" href={`/${params.locale}/classes/${item.id}`}>
                                            {t("view")}
                                        </Link>
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
