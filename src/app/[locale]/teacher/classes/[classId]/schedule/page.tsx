import Link from "next/link";
import { redirect } from "next/navigation";

import { SessionScheduler } from "@/components/teacher/session-scheduler";
import { prisma } from "@/lib/prisma";
import { can, getAccessControl } from "@/lib/security/permissions";

type SchedulePageProps = {
  params: { locale: string; classId: string };
};

export const dynamic = "force-dynamic";

export default async function TeacherClassSchedulePage({ params }: SchedulePageProps) {
  const { locale, classId } = params;

  const access = await getAccessControl();
  if (!access) {
    redirect(`/${locale}/login`);
  }

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, teacherId: true, schedulingMode: true },
  });

  if (!klass) {
    redirect(`/${locale}/teacher/classes`);
  }

  // Authorized when the acting user owns the class, or holds the classes.edit
  // permission (admins / staff managing another instructor's class).
  const isOwner = klass.teacherId === access.userId;
  if (!isOwner && !can(access, "classes.edit")) {
    redirect(`/${locale}/dashboard`);
  }

  const sessions = await prisma.session.findMany({
    where: { classId: klass.id },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      meetLink: true,
      meetLinkStatus: true,
      cancelled: true,
      confirmedAt: true,
    },
  });

  // Serialize Date fields to ISO strings before handing them to the client.
  const serialized = sessions.map((session) => ({
    id: session.id,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime.toISOString(),
    meetLink: session.meetLink,
    meetLinkStatus: session.meetLinkStatus,
    cancelled: session.cancelled,
    confirmedAt: session.confirmedAt ? session.confirmedAt.toISOString() : null,
  }));

  const isManual = klass.schedulingMode === "MANUAL";

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Manage schedule
            </p>
            <h1 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">{klass.name}</h1>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
              isManual
                ? "border-neon-200 bg-neon-50 text-neon-700"
                : "border-gray-200 bg-gray-50 text-gray-600"
            }`}
          >
            {isManual ? "Manual scheduling" : "Auto scheduling"}
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">
          {isManual
            ? "You set and confirm each session time. The auto-scheduler will not create sessions for this class."
            : "Sessions are proposed automatically from availability. You can still add, reschedule, confirm, or cancel them below."}
        </p>
        <div className="mt-4">
          <Link
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
            href={`/${locale}/teacher/classes`}
          >
            &larr; Back to classes
          </Link>
        </div>
      </header>

      <SessionScheduler
        classId={klass.id}
        locale={locale}
        className={klass.name}
        schedulingMode={klass.schedulingMode}
        sessions={serialized}
      />
    </section>
  );
}
