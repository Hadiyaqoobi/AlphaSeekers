/**
 * Helpers for checking access to a class session.
 *
 * - Students: must be enrolled (ACTIVE) and within the live window (15 min before to 2h after start)
 * - Teachers: can access their own class's sessions any time
 * - Admins: can access any session
 */

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/security/session";

const PRE_WINDOW_MS = 15 * 60 * 1000; // 15 min before
const POST_WINDOW_MS = 2 * 60 * 60 * 1000; // 2h after

export type SessionAccessResult =
  | { ok: true; session: SessionWithClass; role: "student" | "teacher" | "admin" }
  | { ok: false; status: 403 | 404 | 410; message: string };

export type SessionWithClass = {
  id: string;
  classId: string;
  startTime: Date;
  endTime: Date;
  meetLink: string | null;
  cancelled: boolean;
  class: {
    id: string;
    name: string;
    teacherId: string;
    subjectCategory: string;
    language: string;
    teacher: { name: string };
  };
};

export async function checkSessionAccess(
  user: SessionUser,
  classId: string,
  sessionId: string,
  options: { liveWindowOnly?: boolean } = {},
): Promise<SessionAccessResult> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      class: {
        include: { teacher: { select: { name: true } } },
      },
    },
  });

  if (!session || session.classId !== classId) {
    return { ok: false, status: 404, message: "Session not found" };
  }

  if (session.cancelled) {
    return { ok: false, status: 410, message: "Session was cancelled" };
  }

  // Admin: full access
  if (user.role === "ADMIN") {
    return { ok: true, session, role: "admin" };
  }

  // Teacher: only their own classes
  if (session.class.teacherId === user.id) {
    return { ok: true, session, role: "teacher" };
  }

  // Student: must be enrolled
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId: user.id, classId } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") {
    return { ok: false, status: 403, message: "You are not enrolled in this class" };
  }

  // Live window check (only for endpoints that require it)
  if (options.liveWindowOnly) {
    const now = Date.now();
    const start = session.startTime.getTime();
    const end = session.endTime?.getTime() || start + 60 * 60 * 1000;
    if (now < start - PRE_WINDOW_MS) {
      return {
        ok: false,
        status: 403,
        message: `This session hasn't started yet. Come back closer to ${session.startTime.toISOString()}.`,
      };
    }
    if (now > end + POST_WINDOW_MS) {
      return {
        ok: false,
        status: 403,
        message: "This live session has ended. You can still view the summary and recording.",
      };
    }
  }

  return { ok: true, session, role: "student" };
}

export function isWithinLiveWindow(start: Date, end: Date | null): boolean {
  const now = Date.now();
  const startMs = start.getTime();
  const endMs = (end || new Date(startMs + 60 * 60 * 1000)).getTime();
  return now >= startMs - PRE_WINDOW_MS && now <= endMs + POST_WINDOW_MS;
}
