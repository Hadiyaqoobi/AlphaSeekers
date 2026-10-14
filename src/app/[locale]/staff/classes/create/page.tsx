import Link from "next/link";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { loadAvailabilityByTeacher } from "@/lib/platform/db-store";
import { ClassCreateForm } from "@/components/staff/staff-class-form";
import { listUsersByRole } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type CreateClassPageProps = {
    params: { locale: string };
};

export default async function StaffCreateClassPage({ params }: CreateClassPageProps) {
    const user = await getSessionUser();

    if (!user) {
        redirect(`/${params.locale}/login`);
    }

    if (user.role !== "ADMIN") {
        redirect(`/${params.locale}/dashboard`);
    }

    const t = await getTranslations({ locale: params.locale, namespace: "staff" });
    const teacherRows = await listUsersByRole("TEACHER");
    // Each teacher's saved hours, so the form can show them and warn before a
    // time is chosen that would book nothing.
    const hours = await loadAvailabilityByTeacher(teacherRows.map((teacher) => teacher.id));
    const teachers = teacherRows.map((teacher) => ({ ...teacher, availability: hours[teacher.id] ?? [] }));

    return (
        <section className="mx-auto max-w-xl space-y-4 sm:space-y-5">
            <header className="hero-panel p-5 sm:p-6">
                <p className="section-kicker">{t("title")}</p>
                <h1 className="text-3xl font-black text-ink-main sm:text-4xl">{t("createClassTitle")}</h1>
                <p className="mt-2 text-sm text-ink-soft">
                    {t("createClassSubtitle")}
                </p>
                <div className="mt-4">
                    <Link className="btn-secondary" href={`/${params.locale}/staff/dashboard`}>
                        {t("backToDashboard")}
                    </Link>
                </div>
            </header>

            <ClassCreateForm autosaveKey="staff-class-create" teachers={teachers} />
        </section>
    );
}
