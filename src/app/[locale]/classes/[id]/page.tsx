import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AnnouncementForm } from "@/components/classes/announcement-form";
import { CancelSessionButton } from "@/components/classes/cancel-session-button";
import { ClassDangerZone } from "@/components/admin/class-danger-zone";
import { EnrollButton } from "@/components/classes/enroll-button";
import { formatDateTime } from "@/lib/format-date";
import { MaterialUploadForm } from "@/components/classes/material-upload-form";
import { DataCostBadge } from "@/components/data-cost-badge";
import { SaveOfflineButton } from "@/components/save-offline-button";
import { getClassById, isStudentEnrolledInClass, listClassAnnouncements, listClassEnrollments } from "@/lib/platform/store";
import { getAccessControl, can } from "@/lib/security/permissions";
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

  // Admin-only: resolves the live permission row so we can offer archive/delete
  // right here (this is the class page the dashboard links to). Students and
  // teachers never hold classes.delete, so the danger zone stays hidden for them.
  const access = await getAccessControl();

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

        {canAccessPrivateDetails && (record as { whatsappGroupUrl?: string | null }).whatsappGroupUrl ? (
          <div className="mt-3">
            <a
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white"
              href={(record as { whatsappGroupUrl?: string | null }).whatsappGroupUrl as string}
              rel="noreferrer"
              style={{ backgroundColor: "#25D366" }}
              target="_blank"
            >
              <svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.2c-.24.68-1.42 1.31-1.95 1.35-.5.04-1.13.2-3.86-.81-3.26-1.29-5.35-4.58-5.51-4.79-.16-.21-1.32-1.76-1.32-3.36 0-1.6.84-2.38 1.14-2.71.3-.32.65-.4.87-.4.22 0 .43 0 .62.01.2.01.47-.08.73.56.27.65.91 2.25.99 2.41.08.16.13.35.02.56-.11.21-.16.35-.32.53-.16.19-.34.42-.48.56-.16.16-.33.34-.14.66.19.32.84 1.39 1.81 2.25 1.24 1.11 2.29 1.45 2.61 1.61.32.16.51.13.7-.08.19-.21.81-.94 1.02-1.26.21-.32.43-.27.72-.16.29.11 1.86.88 2.18 1.04.32.16.53.24.61.37.08.13.08.76-.16 1.44z" />
              </svg>
              WhatsApp
            </a>
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

      {can(access, "classes.delete") ? (
        <ClassDangerZone
          canHardDelete={can(access, "classes.delete")}
          classId={record.id}
          className={record.name}
          locale={locale}
          returnTo={`/${locale}/classes`}
        />
      ) : null}
    </section>
  );
}
