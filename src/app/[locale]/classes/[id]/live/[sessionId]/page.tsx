import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { CompanionPanel } from "@/components/session/companion-panel";
import { getSessionUser } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { locale: string; id: string; sessionId: string };
}

export async function generateMetadata({ params }: PageProps) {
  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: { class: { select: { name: true } } },
  });
  if (!session) return { title: "Session — AlphaSeekers" };
  return {
    title: `${session.class.name} live session — AlphaSeekers`,
  };
}

export default async function LiveSessionPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/${params.locale}/login?callbackUrl=/${params.locale}/classes/${params.id}/live/${params.sessionId}`,
    );
  }

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) {
    if (access.status === 404) notFound();
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-ink-main mb-3">
          {access.status === 410 ? "Session cancelled" : "Cannot open this session"}
        </h1>
        <p className="text-ink-soft mb-8">{access.message}</p>
        <Link
          href={`/${params.locale}/classes/${params.id}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-600 text-white font-semibold hover:bg-neon-700"
        >
          ← Back to class
        </Link>
      </main>
    );
  }

  const { session, role } = access;

  // Fetch all initial data server-side
  const [materials, attendance, notes, summary, homework, attendanceRoster] =
    await Promise.all([
      prisma.material.findMany({
        where: { classId: params.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, fileUrl: true, createdAt: true },
      }),
      role === "student"
        ? prisma.attendance.findUnique({
            where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } },
          })
        : Promise.resolve(null),
      role === "student"
        ? prisma.sessionNote.findUnique({
            where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } },
          })
        : Promise.resolve(null),
      prisma.sessionSummary.findUnique({
        where: { sessionId: session.id },
        select: { content: true, contentDari: true, quizData: true, generatedAt: true },
      }),
      prisma.homeworkAssignment.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "desc" },
        include:
          role === "student"
            ? {
                submissions: {
                  where: { studentId: user.id },
                },
              }
            : { submissions: true },
      }),
      role === "teacher" || role === "admin"
        ? loadAttendanceRoster(params.id, session.id)
        : Promise.resolve(null),
    ]);

  const isLanguageClass =
    session.class.subjectCategory === "languages" ||
    /english|korean|chinese|spanish|arabic|german|french|language|grammar|vocabulary/i.test(
      session.class.name,
    );

  const initialData = {
    role,
    session: {
      id: session.id,
      classId: session.classId,
      className: session.class.name,
      teacherName: session.class.teacher.name,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      meetLink: session.meetLink,
      isLanguageClass,
    },
    materials: materials.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    attendance: attendance
      ? { joinedAt: attendance.joinedAt?.toISOString() ?? null }
      : null,
    notes: notes
      ? { content: notes.content, updatedAt: notes.updatedAt.toISOString() }
      : null,
    summary: summary
      ? {
          content: summary.content,
          quizData: summary.quizData,
          generatedAt: summary.generatedAt.toISOString(),
        }
      : null,
    homework: homework.map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      dueDate: h.dueDate?.toISOString() ?? null,
      submissions: h.submissions.map((s) => ({
        id: s.id,
        content: s.content,
        fileUrl: s.fileUrl,
        imageUrl: s.imageUrl,
        aiReview: s.aiReview,
        teacherGrade: s.teacherGrade,
        teacherNotes: s.teacherNotes,
        submittedAt: s.submittedAt.toISOString(),
      })),
    })),
    attendanceRoster,
  };

  return (
    <main className="bg-dark-50 min-h-screen py-6 lg:py-8">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/${params.locale}/classes/${params.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink-main font-medium"
          >
            ← Back to class
          </Link>
        </div>

        <CompanionPanel initialData={initialData} locale={params.locale as "en" | "fa"} />
      </div>
    </main>
  );
}

async function loadAttendanceRoster(classId: string, sessionId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { classId, status: "ACTIVE" },
    include: { student: { select: { id: true, name: true } } },
  });
  const attendance = await prisma.attendance.findMany({ where: { sessionId } });
  const map = new Map(attendance.map((a) => [a.studentId, a]));

  return enrollments.map((e) => {
    const att = map.get(e.student.id);
    return {
      studentId: e.student.id,
      studentName: e.student.name,
      attended: att?.attended || false,
      joinedAt: att?.joinedAt?.toISOString() || null,
    };
  });
}
