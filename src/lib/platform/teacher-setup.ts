import { ClassStatus, EnrollmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { planAutoSlot, type SlotProblem } from "@/lib/scheduling/weekly-slot";

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
    /** MANUAL = the teacher adds every session on the schedule page. */
    schedulingMode: "AUTO" | "MANUAL";
    /**
     * AUTO only: why the scheduler cannot book this class's posted time, or null
     * when it can (see src/lib/scheduling/weekly-slot.ts).
     */
    scheduleProblem: SlotProblem | null;
    upcomingSessions: number;
    /** Students actually in the class (ACTIVE), not pending or declined requests. */
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
      select: { dayOfWeek: true, startTimeUTC: true, endTimeUTC: true },
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
        schedulingMode: true,
        durationMinutes: true,
        _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } } },
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
      schedulingMode: c.schedulingMode,
      scheduleProblem:
        c.schedulingMode === "AUTO"
          ? (() => {
              const plan = planAutoSlot({ schedulePreference: c.schedulePreference });
              return plan.ok ? null : plan.reason;
            })()
          : null,
      upcomingSessions: c.sessions.length,
      enrolledCount: c._count.enrollments,
    })),
    // A teacher whose classes are all MANUAL never needs availability: they add
    // each session themselves on the class's schedule page.
    complete:
      availability.length > 0 || (classes.length > 0 && classes.every((c) => c.schedulingMode === "MANUAL")),
  };
}
