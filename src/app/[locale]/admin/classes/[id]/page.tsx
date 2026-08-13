import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";

import { AdminClassActions } from "@/components/admin/admin-class-actions";
import { ClassDangerZone } from "@/components/admin/class-danger-zone";
import { ClassWhatsAppEditor } from "@/components/admin/class-whatsapp-editor";
import { formatDateTime } from "@/lib/format-date";
import { getClassById, listClassEnrollments, getClassAttendanceSummary } from "@/lib/platform/store";
import { getAccessControl, can, isSuper } from "@/lib/security/permissions";

type AdminClassDetailPageProps = {
  params: { locale: string; id: string };
};

export default async function AdminClassDetailPage({ params }: AdminClassDetailPageProps) {
  const access = await getAccessControl();

  if (!access) {
    redirect(`/${params.locale}/login`);
  }

  if (!can(access, "classes.view")) {
    redirect(`/${params.locale}/dashboard`);
  }

  // Admins manage archived classes too -- that is where permanent deletion happens.
  const record = await getClassById(params.id, { includeArchived: true });
  if (!record) {
    notFound();
  }

  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "adminClassDetail" });
  const enrolledStudents = await listClassEnrollments(record.id);
  const attendanceSummary = (await getClassAttendanceSummary(record.id)) as {
    totalSessions: number;
    totalStudents: number;
    students: Array<{
      studentId: string;
      studentName: string;
      studentEmail: string;
      sessionsAttended: number;
      totalSessions: number;
      attendanceRate: number;
    }>;
  };

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="badge-pill">{record.subjectCategory}</p>
            <h1 className="mt-2 text-3xl font-black text-ink-main sm:text-4xl">{record.name}</h1>
          </div>
          <Link className="btn-secondary" href={`/${locale}/admin/classes`}>
            {t("backToAdmin")}
          </Link>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-main">{record.description}</p>
        <div className="mt-4 grid gap-2 text-sm text-ink-main sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="font-semibold text-ink-soft">{t("teacher")}:</span> {record.teacherName}
          </p>
          <p>
            <span className="font-semibold text-ink-soft">{t("schedule")}:</span> {record.schedulePreference}
          </p>
          <p>
            <span className="font-semibold text-ink-soft">{t("enrolled")}:</span> {record.enrolledCount} / {record.maxStudents}
          </p>
          <p>
            <span className="font-semibold text-ink-soft">{t("duration")}:</span> {record.durationMinutes} {t("minutes")}
          </p>
        </div>
      </header>

      <AdminClassActions classId={record.id} />

      {can(access, "classes.edit") ? (
        <ClassWhatsAppEditor
          classId={record.id}
          initialUrl={(record as { whatsappGroupUrl?: string | null }).whatsappGroupUrl ?? null}
        />
      ) : null}

      <div className="grid gap-px bg-dark-200 rounded-lg overflow-hidden sm:grid-cols-4">
        <article className="bg-dark-100 p-4">
          <p className="text-sm text-ink-soft">{t("stats.enrolled")}</p>
          <p className="mt-1 text-2xl font-bold text-ink-main">{enrolledStudents.length}</p>
        </article>
        <article className="bg-dark-100 p-4">
          <p className="text-sm text-ink-soft">{t("stats.sessions")}</p>
          <p className="mt-1 text-2xl font-bold text-ink-main">{record.sessions.length}</p>
        </article>
        <article className="bg-dark-100 p-4">
          <p className="text-sm text-ink-soft">{t("stats.materials")}</p>
          <p className="mt-1 text-2xl font-bold text-ink-main">{record.materials.length}</p>
        </article>
        <article className="bg-dark-100 p-4">
          <p className="text-sm text-ink-soft">{t("stats.attendanceRate")}</p>
          <p className="mt-1 text-2xl font-bold text-ink-main">
            {attendanceSummary.totalSessions > 0
              ? Math.round(
                  attendanceSummary.students.reduce((sum, s) => sum + s.attendanceRate, 0) /
                    Math.max(1, attendanceSummary.students.length),
                )
              : 0}
            %
          </p>
        </article>
      </div>

      <section className="panel panel-strong p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-ink-main">{t("enrolledStudents")}</h2>
          <span className="text-sm text-ink-soft">{enrolledStudents.length} {t("total")}</span>
        </div>
        {enrolledStudents.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t("noStudents")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  <th className="py-2 font-semibold" scope="col">{t("studentName")}</th>
                  <th className="py-2 font-semibold" scope="col">{t("studentEmail")}</th>
                  <th className="py-2 font-semibold" scope="col">{t("enrolledAt")}</th>
                  <th className="py-2 font-semibold" scope="col">{t("attendanceLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudents.map((student: { studentId: string; name: string; email: string; enrolledAt: Date | string }) => {
                  const stats = attendanceSummary.students.find((s) => s.studentId === student.studentId);
                  return (
                    <tr className="border-b border-line-soft text-ink-main" key={student.studentId}>
                      <td className="py-2 font-semibold text-ink-main">{student.name}</td>
                      <td className="py-2">{student.email}</td>
                      <td className="py-2">{formatDateTime(student.enrolledAt, locale)}</td>
                      <td className="py-2">
                        {stats ? (
                          <span className={stats.attendanceRate >= 70 ? "text-neon-400" : stats.attendanceRate >= 40 ? "text-amber-300" : "text-red-300"}>
                            {stats.sessionsAttended}/{stats.totalSessions} ({stats.attendanceRate}%)
                          </span>
                        ) : (
                          <span className="text-ink-faint">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel panel-strong p-4 sm:p-5">
        <h2 className="text-lg font-black text-ink-main">{t("sessions")}</h2>
        <div className="mt-3 space-y-2">
          {record.sessions.slice(0, 10).map((session) => (
            <div
              className={`flex items-center justify-between rounded-lg border border-line-soft px-3 py-2 ${session.cancelled ? "opacity-50" : ""}`}
              key={session.id}
            >
              <div>
                <p className="text-sm font-semibold text-ink-main">
                  {formatDateTime(session.startTime, locale)}
                  {session.cancelled ? (
                    <span className="ml-2 text-xs font-normal text-red-300">{t("cancelled")}</span>
                  ) : null}
                </p>
                <p className="text-xs text-ink-soft">
                  {t("meetStatus")}: {session.meetLinkStatus}
                </p>
              </div>
              {session.meetLink && !session.cancelled ? (
                <a
                  className="text-xs font-semibold text-neon-400 hover:underline"
                  href={session.meetLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("openMeet")}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {record.materials.length > 0 ? (
        <section className="panel panel-strong p-4 sm:p-5">
          <h2 className="text-lg font-black text-ink-main">{t("materials")}</h2>
          <div className="mt-3 space-y-2">
            {record.materials.map((material) => (
              <div className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2" key={material.id}>
                <div>
                  <p className="text-sm font-medium text-ink-main">{material.title}</p>
                  <p className="text-xs text-ink-soft">{(material.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <a className="btn-secondary text-xs" href={material.fileUrl} rel="noreferrer" target="_blank">
                  {t("download")}
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {can(access, "classes.delete") ? (
        <ClassDangerZone
          canHardDelete={isSuper(access)}
          classId={record.id}
          className={record.name}
          locale={locale}
        />
      ) : null}
    </section>
  );
}
