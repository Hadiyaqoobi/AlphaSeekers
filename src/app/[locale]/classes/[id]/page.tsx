import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AnnouncementForm } from "@/components/classes/announcement-form";
import { CancelSessionButton } from "@/components/classes/cancel-session-button";
import { EnrollButton } from "@/components/classes/enroll-button";
import { formatDateTime } from "@/lib/format-date";
import { MaterialUploadForm } from "@/components/classes/material-upload-form";
import { DataCostBadge } from "@/components/data-cost-badge";
import { SaveOfflineButton } from "@/components/save-offline-button";
import { getClassById, isStudentEnrolledInClass, listClassAnnouncements, listClassEnrollments } from "@/lib/platform/store";
import { getSessionUser } from "@/lib/security/session";

type ClassDetailPageProps = {
  params: { locale: string; id: string };
};

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
  const record = await getClassById(params.id);
  const user = await getSessionUser();
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: "classDetail" });

  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (!user.approved && user.role !== "ADMIN") {
    redirect(`/${locale}/pending-approval`);
  }

  if (!record) {
    notFound();
  }

  const studentEnrolled =
    user?.role === "STUDENT" ? await isStudentEnrolledInClass(user.id, record.id) : false;

  const canAccessPrivateDetails = Boolean(
    user &&
      (user.role === "ADMIN" ||
        (user.role === "TEACHER" && user.approved && user.id === record.teacherId) ||
        (user.role === "STUDENT" && user.approved && studentEnrolled)),
  );

  const canUploadMaterials = user.role === "ADMIN" || (user.role === "TEACHER" && user.id === record.teacherId);
  const enrolledStudents = canUploadMaterials ? await listClassEnrollments(record.id) : [];
  const announcements = canAccessPrivateDetails
    ? ((await listClassAnnouncements(record.id)) as Array<{ id: string; content: string; authorName: string; createdAt: string }>)
    : [];
  const tAnnounce = await getTranslations({ locale, namespace: "announcements" });
  const tSession = await getTranslations({ locale, namespace: "sessionActions" });

  return (
    <section className="space-y-4 sm:space-y-5">
      <header className="hero-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="badge-pill">{record.subjectCategory}</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">{record.name}</h1>
          </div>
          <Link className="btn-secondary" href={`/${locale}/classes`}>
            {t("backToClasses")}
          </Link>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">{record.description}</p>
        <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
          <p>
            <span className="font-semibold text-slate-500">{t("teacher")}:</span> {record.teacherName}
          </p>
          <p>
            <span className="font-semibold text-slate-500">{t("schedule")}:</span> {record.schedulePreference}
          </p>
          <p>
            <span className="font-semibold text-slate-500">{t("language")}:</span> {record.language}
          </p>
          <p>
            <span className="font-semibold text-slate-500">{t("enrolled")}:</span> {record.enrolledCount} / {record.maxStudents}
          </p>
          <p>
            <span className="font-semibold text-slate-500">{t("duration")}:</span> {record.durationMinutes} {t("minutes")}
          </p>
        </div>

        {record.durationMinutes > 60 ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            {t("multiSegmentNotice")}
          </p>
        ) : null}

        {user?.role === "STUDENT" ? (
          <div className="mt-4">
            <EnrollButton classId={record.id} initiallyEnrolled={studentEnrolled} />
          </div>
        ) : null}
      </header>

      <section className="panel panel-strong p-4 sm:p-5">
        <h2 className="text-lg font-black text-slate-900">{t("upcomingSessions")}</h2>
        <div className="timeline-line mt-3 space-y-2">
          {record.sessions.slice(0, 6).map((session) => (
            <article className={`stat-card p-3 ${session.cancelled ? "opacity-50" : ""}`} key={session.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {formatDateTime(session.startTime, locale)}
                  {session.cancelled ? <span className="ml-2 text-xs font-normal text-red-500">{tSession("cancelled")}</span> : null}
                </p>
                {canUploadMaterials && !session.cancelled ? (
                  <CancelSessionButton classId={record.id} sessionId={session.id} />
                ) : null}
              </div>
              {!session.cancelled ? (
                <>
                  <p className="text-xs text-slate-600">
                    {t("meetStatus")}: {session.meetLinkStatus}
                  </p>
                  {canAccessPrivateDetails && session.meetLink ? (
                    <a className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline" href={session.meetLink} rel="noreferrer" target="_blank">
                      {t("openMeet")}
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {session.meetLink
                        ? t("joinAfterEnroll")
                        : t("meetPending")}
                    </p>
                  )}
                </>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {canAccessPrivateDetails ? (
        <section className="panel panel-strong p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-900">{tAnnounce("title")}</h2>
          {canUploadMaterials ? <AnnouncementForm classId={record.id} /> : null}
          <div className="mt-3 space-y-2">
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-500">{tAnnounce("empty")}</p>
            ) : (
              announcements.map((a) => (
                <div className="rounded-lg border border-slate-100 p-3" key={a.id}>
                  <p className="text-sm text-slate-700">{a.content}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {a.authorName} &middot; {formatDateTime(a.createdAt, locale)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="panel panel-strong p-4 sm:p-5">
        <h2 className="text-lg font-black text-slate-900">{t("materialsTitle")}</h2>
        <div className="mt-3 space-y-2">
          {!canAccessPrivateDetails ? (
            <p className="text-sm text-slate-600">{t("materialsRestricted")}</p>
          ) : null}

          {canUploadMaterials ? <MaterialUploadForm classId={record.id} /> : null}

          {canAccessPrivateDetails && record.materials.length === 0 ? (
            <p className="text-sm text-slate-600">{t("noMaterials")}</p>
          ) : canAccessPrivateDetails ? (
            record.materials.map((material) => (
              <article className="stat-card flex flex-wrap items-center justify-between gap-2 p-3" key={material.id}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{material.title}</p>
                  <p className="flex items-center gap-2 text-xs text-slate-600">
                    {(material.fileSize / 1024 / 1024).toFixed(2)} MB
                    <DataCostBadge fileSize={material.fileSize} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    className="btn-secondary"
                    href={material.fileUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t("download")}
                  </a>
                  <SaveOfflineButton fileUrl={material.fileUrl} title={material.title} />
                </div>
              </article>
            ))
          ) : null}
        </div>
      </section>

      {canUploadMaterials && enrolledStudents.length > 0 ? (
        <section className="panel panel-strong p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-900">{t("studentsTitle")}</h2>
          <div className="mt-3 space-y-1">
            {enrolledStudents.map((student) => (
              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2" key={student.studentId}>
                <div>
                  <p className="text-sm font-medium text-slate-900">{student.name}</p>
                  <p className="text-xs text-slate-500">{student.email}</p>
                </div>
                <p className="text-xs text-slate-400">{formatDateTime(student.enrolledAt, locale)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
