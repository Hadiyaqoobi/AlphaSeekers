/**
 * GET /api/classes/[id]/sessions/[sessionId]/live
 *
 * Returns everything the live session hub needs:
 * session details, materials, vocabulary, attendance, notes, summary, quiz, homework.
 */

import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/security/session";
import { checkSessionAccess } from "@/lib/session-access";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const access = await checkSessionAccess(user, params.id, params.sessionId);
  if (!access.ok) {
    return Response.json({ message: access.message }, { status: access.status });
  }

  const { session, role } = access;

  // Materials for this class (recent)
  const materials = await prisma.material.findMany({
    where: { classId: params.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, fileUrl: true, createdAt: true },
  });

  // Student-specific data (only for students)
  let attendance = null;
  let notes = null;
  if (role === "student") {
    [attendance, notes] = await Promise.all([
      prisma.attendance.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } },
      }),
      prisma.sessionNote.findUnique({
        where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } },
      }),
    ]);
  }

  // Summary (visible to all)
  const summary = await prisma.sessionSummary.findUnique({
    where: { sessionId: session.id },
    select: { content: true, contentDari: true, quizData: true, generatedAt: true },
  });

  // Homework
  const homework = await prisma.homeworkAssignment.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    include:
      role === "student"
        ? {
            submissions: {
              where: { studentId: user.id },
              select: {
                id: true,
                content: true,
                fileUrl: true,
                imageUrl: true,
                aiReview: true,
                teacherGrade: true,
                teacherNotes: true,
                submittedAt: true,
              },
            },
          }
        : {
            submissions: {
              select: {
                id: true,
                studentId: true,
                aiReview: true,
                teacherGrade: true,
                submittedAt: true,
              },
            },
          },
  });

  // For teachers: real-time attendance roster
  let attendanceRoster = null;
  if (role === "teacher" || role === "admin") {
    const enrollments = await prisma.enrollment.findMany({
      where: { classId: params.id, status: "ACTIVE" },
      include: {
        student: { select: { id: true, name: true } },
      },
    });
    const attendanceRecords = await prisma.attendance.findMany({
      where: { sessionId: session.id },
    });
    const attendanceMap = new Map(attendanceRecords.map((a) => [a.studentId, a]));

    attendanceRoster = enrollments.map((e) => {
      const att = attendanceMap.get(e.student.id);
      return {
        studentId: e.student.id,
        studentName: e.student.name,
        attended: att?.attended || false,
        joinedAt: att?.joinedAt || null,
      };
    });
  }

  return Response.json({
    role,
    session: {
      id: session.id,
      classId: session.classId,
      className: session.class.name,
      teacherName: session.class.teacher.name,
      startTime: session.startTime,
      endTime: session.endTime,
      meetLink: session.meetLink,
      isLanguageClass:
        session.class.subjectCategory === "languages" ||
        /english|korean|chinese|spanish|arabic|german|french|language|grammar|vocabulary/i.test(
          session.class.name,
        ),
    },
    materials,
    attendance,
    notes,
    summary,
    homework,
    attendanceRoster,
  });
}
