import { ClassStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * The two things a teacher must do before their class can run, plus what the
 * platform has managed to do as a result.
 *
 * Reported as live state rather than written as instructions, because the whole
 * failure mode this addresses was a teacher having no idea anything was waiting
 * on them: a class assigned in August 2026 sat with zero sessions because the
 * scheduler silently skips any class whose teacher has not set availability.
 */
export type TeacherSetupStatus = {
  availabilitySet: boolean;
  availabilityDays: number;
  googleConnected: boolean;
  googleAccountEmail: string | null;
  classes: Array<{
    id: string;
    name: string;
    schedulePreference: string | null;
    upcomingSessions: number;
    enrolledCount: number;
  }>;
  /**
   * True once the class can actually run. That means availability ONLY:
   * connecting Google is optional, because getCalendarClient falls back to the
   * shared platform account when a teacher has not linked their own. Treating
   * Google as required told teachers their class was blocked when it was not.
   */
  complete: boolean;
};

export async function getTeacherSetupStatus(teacherId: string): Promise<TeacherSetupStatus> {
  const now = new Date();

  const [availability, googleLink, classes] = await Promise.all([
    prisma.teacherAvailability.findMany({
      where: { teacherId },
      select: { dayOfWeek: true },
    }),
    prisma.googleAccountLink.findUnique({
      where: { userId: teacherId },
      select: { googleEmail: true },
    }),
    prisma.class.findMany({
      where: { teacherId, status: ClassStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        schedulePreference: true,
        _count: { select: { enrollments: true } },
        sessions: {
          where: { cancelled: false, startTime: { gte: now } },
          select: { id: true },
        },
      },
    }),
  ]);

  const availabilityDays = new Set(availability.map((a) => a.dayOfWeek)).size;

  return {
    availabilitySet: availability.length > 0,
    availabilityDays,
    googleConnected: Boolean(googleLink),
    googleAccountEmail: googleLink?.googleEmail ?? null,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      schedulePreference: c.schedulePreference,
      upcomingSessions: c.sessions.length,
      enrolledCount: c._count.enrollments,
    })),
    complete: availability.length > 0,
  };
}
