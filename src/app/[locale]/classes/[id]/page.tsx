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
            <h1 className="mt-2 text-3xl font-black text-ink-main sm:text-4xl">{record.name}</h1>
          </div>
          <Link className="btn-secondary" href={`/${locale}/classes`}>
            {t("backToClasses")}
          </Link>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-main">{record.description}</p>
        <div className="mt-4 grid gap-2 text-sm text-ink-main sm:grid-cols-2 lg:grid-cols-3">
          <p>
            <span className="font-semibold text-ink-soft">{t("teacher")}:</span> {record.teacherName}
          </p>
          <p>
            <span className="font-semibold text-ink-soft">{t("schedule")}:</span> {record.schedulePreference}
          </p>
          <p>
            <span className="font-semibold text-ink-soft">{t("language")}:</span> {record.language}
          </p>
          <p>
            <span className="font-semibold text-ink-soft">{t("enrolled")}:</span> {record.enrolledCount} / {record.maxStudents}
          </p>
          <p>
            <span className="font-semibold text-ink-soft">{t("duration")}:</span> {record.durationMinutes} {t("minutes")}
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
        <h2 className="text-lg font-black text-ink-main">{t("upcomingSessions")}</h2>
        <div className="timeline-line mt-3 space-y-2">
          {record.sessions.slice(0, 6).map((session) => (
            <article className={`stat-card p-3 ${session.cancelled ? "opacity-50" : ""}`} key={session.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-main">
                  {formatDateTime(session.startTime, locale)}
                  {session.cancelled ? <span className="ml-2 text-xs font-normal text-red-500">{tSession("cancelled")}</span> : null}
                </p>
                {canUploadMaterials && !session.cancelled ? (
                  <CancelSessionButton classId={record.id} sessionId={session.id} />
                ) : null}
              </div>
              {!session.cancelled ? (
                <>
                  <p className="text-xs text-ink-soft">
                    {t("meetStatus")}: {session.meetLinkStatus}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {canAccessPrivateDetails && session.meetLink ? (
                      <a className="text-xs font-semibold text-neon-700 underline-offset-2 hover:underline" href={session.meetLink} rel="noreferrer" target="_blank">
                        {t("openMeet")}
                      </a>
                    ) : (
                      <p className="text-xs text-ink-soft">
                        {session.meetLink
                          ? t("joinAfterEnroll")
                          : t("meetPending")}
                      </p>
                    )}
                    {canAccessPrivateDetails && (
                      <Link
                        className="text-xs font-semibold text-neon-700 hover:text-neon-800"
                        href={`/${locale}/classes/${record.id}/live/${session.id}`}
                      >
                        Live session →
                      </Link>
                    )}
                  </div>
                </>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {canAccessPrivateDetails ? (
        <section className="panel panel-strong p-4 sm:p-5">
          <h2 className="text-lg font-black text-ink-main">{tAnnounce("title")}</h2>
          {canUploadMaterials ? <AnnouncementForm classId={record.id} /> : null}
          <div className="mt-3 space-y-2">
            {announcements.length === 0 ? (
              <p className="text-sm text-ink-soft">{tAnnounce("empty")}</p>
            ) : (
              announcements.map((a) => (
                <div className="rounded-lg border border-line-soft p-3" key={a.id}>
                  <p className="text-sm text-ink-main">{a.content}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {a.authorName} &middot; {formatDateTime(a.createdAt, locale)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="panel panel-strong p-4 sm:p-5">
        <h2 className="text-lg font-black text-ink-main">{t("materialsTitle")}</h2>
        <div className="mt-3 space-y-2">
          {!canAccessPrivateDetails ? (
            <p className="text-sm text-ink-soft">{t("materialsRestricted")}</p>
          ) : null}

          {canUploadMaterials ? <MaterialUploadForm classId={record.id} /> : null}

          {canAccessPrivateDetails && record.materials.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("noMaterials")}</p>
          ) : canAccessPrivateDetails ? (
            record.materials.map((material) => (
              <article className="stat-card flex flex-wrap items-center justify-between gap-2 p-3" key={material.id}>
                <div>
                  <p className="text-sm font-semibold text-ink-main">{material.title}</p>
                  <p className="flex items-center gap-2 text-xs text-ink-soft">
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
          <h2 className="text-lg font-black text-ink-main">{t("studentsTitle")}</h2>
          <div className="mt-3 space-y-1">
            {enrolledStudents.map((student) => (
              <div className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2" key={student.studentId}>
                <div>
                  <p className="text-sm font-medium text-ink-main">{student.name}</p>
                  <p className="text-xs text-ink-soft">{student.email}</p>
                </div>
                <p className="text-xs text-ink-faint">{formatDateTime(student.enrolledAt, locale)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
