import { prisma } from "@/lib/prisma";
import { classSpanMinutes, planAutoSlot } from "@/lib/scheduling/weekly-slot";

/**
 * Class health checks.
 *
 * Every check here exists because the condition it looks for is currently
 * invisible: it breaks a class quietly, and the first person to notice is a
 * student who turns up to nothing. None of these are hypothetical — each one
 * has either happened on this platform or is true of a live class today.
 *
 * Deliberately read-only and side-effect free, so it can back both the daily
 * digest and (later) a dashboard panel without either owning the logic.
 */

/** A request left this long without a decision is treated as forgotten. */
const STALE_REQUEST_HOURS = 24;
/**
 * Below this many future sessions, a MANUAL class is running out of runway.
 * AUTO classes are exempt: the scheduler deliberately keeps exactly ONE upcoming
 * session (it books the next week once this week's has passed), so a threshold
 * of 2 raised a false alarm every day for every healthy AUTO class.
 */
const LOW_SESSION_THRESHOLD = 2;
/** How far ahead to insist a session already has a usable joining link. */
const LINK_WINDOW_HOURS = 48;

export type IssueSeverity = "urgent" | "warning";

export type ClassIssue = {
  severity: IssueSeverity;
  kind: string;
  classId: string | null;
  className: string;
  detail: string;
};

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

function hoursAhead(h: number): Date {
  return new Date(Date.now() + h * 3_600_000);
}

function waited(since: Date): string {
  const h = Math.round((Date.now() - since.getTime()) / 3_600_000);
  if (h < 48) return `${h} hours`;
  return `${Math.round(h / 24)} days`;
}

export async function collectClassIssues(): Promise<ClassIssue[]> {
  const issues: ClassIssue[] = [];

  const classes = await prisma.class.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      teacherId: true,
      maxStudents: true,
      schedulingMode: true,
      schedulePreference: true,
      durationMinutes: true,
      teacher: { select: { id: true, name: true } },
    },
  });

  for (const klass of classes) {
    const name = klass.name.trim();

    const [activeCount, pending, futureSessions, availability] = await Promise.all([
      prisma.enrollment.count({ where: { classId: klass.id, status: "ACTIVE" } }),
      prisma.enrollment.findMany({
        where: { classId: klass.id, status: "PENDING" },
        select: { enrolledAt: true },
        orderBy: { enrolledAt: "asc" },
      }),
      prisma.session.count({
        where: { classId: klass.id, startTime: { gte: new Date() }, cancelled: false },
      }),
      klass.teacherId
        ? prisma.teacherAvailability.findMany({
            where: { teacherId: klass.teacherId },
            select: { dayOfWeek: true, startTimeUTC: true, endTimeUTC: true },
          })
        : Promise.resolve([]),
    ]);
    const availabilityWindows = availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startMinute: a.startTimeUTC.getUTCHours() * 60 + a.startTimeUTC.getUTCMinutes(),
      endMinute: a.endTimeUTC.getUTCHours() * 60 + a.endTimeUTC.getUTCMinutes(),
    }));

    // A class with no teacher cannot generate sessions and cannot be taught. It
    // is the loudest possible failure and the easiest one to leave unnoticed,
    // because the class still looks fine in the catalogue.
    if (!klass.teacherId) {
      issues.push({
        severity: "urgent",
        kind: "no-teacher",
        classId: klass.id,
        className: name,
        detail: "This class is active but has no teacher assigned.",
      });
    }

    // Requests that have sat past the threshold. The immediate notification
    // fires once; if nobody acted on it, nothing said so again until now.
    const stale = pending.filter((p) => p.enrolledAt < hoursAgo(STALE_REQUEST_HOURS));
    if (stale.length > 0) {
      issues.push({
        severity: "urgent",
        kind: "stale-requests",
        classId: klass.id,
        className: name,
        detail:
          `${stale.length} ${stale.length === 1 ? "student has" : "students have"} been waiting ` +
          `over ${STALE_REQUEST_HOURS} hours for a decision (longest: ${waited(stale[0].enrolledAt)}).`,
      });
    }

    // Requests pending against a class with no room. Approving is impossible, so
    // this needs a capacity decision rather than a queue-clearing session, and
    // it will otherwise sit in the queue looking like ordinary work.
    if (pending.length > 0 && activeCount >= klass.maxStudents) {
      issues.push({
        severity: "urgent",
        kind: "full-with-requests",
        classId: klass.id,
        className: name,
        detail:
          `${pending.length} waiting but the class is full (${activeCount}/${klass.maxStudents}). ` +
          `Raise the capacity or decline them — they cannot be approved as it stands.`,
      });
    }

    // The scheduler builds sessions ahead on a rolling horizon. When that count
    // falls, either the horizon is exhausted or the scheduler has stopped
    // producing — which it once did, silently, for three and a half months.
    if (futureSessions === 0) {
      issues.push({
        severity: "urgent",
        kind: "no-future-sessions",
        classId: klass.id,
        className: name,
        detail: "No upcoming sessions are scheduled. Students have nothing to join.",
      });
    } else if (klass.schedulingMode === "MANUAL" && futureSessions < LOW_SESSION_THRESHOLD) {
      issues.push({
        severity: "warning",
        kind: "low-future-sessions",
        classId: klass.id,
        className: name,
        detail:
          `Only ${futureSessions} upcoming session scheduled. ` +
          `Check the teacher's availability covers the weeks ahead.`,
      });
    }

    // An AUTO class whose teacher has declared nothing can never generate a
    // session, and will present as "no upcoming sessions" with no stated cause.
    if (klass.schedulingMode === "AUTO" && klass.teacherId && availabilityWindows.length === 0) {
      issues.push({
        severity: "urgent",
        kind: "no-availability",
        classId: klass.id,
        className: name,
        detail:
          `${klass.teacher?.name ?? "The teacher"} has not set any availability, ` +
          `so no sessions can be generated automatically.`,
      });
    }

    // The scheduler books an AUTO class only at its posted day/time and only when
    // that lies inside the teacher's availability; it never moves the class.
    // When it cannot, say exactly why instead of a bare "no upcoming sessions".
    if (klass.schedulingMode === "AUTO" && availabilityWindows.length > 0) {
      const plan = planAutoSlot({
        schedulePreference: klass.schedulePreference,
        spanMinutes: classSpanMinutes(klass.durationMinutes),
        availability: availabilityWindows,
      });
      if (!plan.ok && plan.reason === "unparseable") {
        issues.push({
          severity: "urgent",
          kind: "schedule-unreadable",
          classId: klass.id,
          className: name,
          detail:
            `The class time "${klass.schedulePreference ?? ""}" is not a day and time the scheduler can read ` +
            `(e.g. "Tue 6:00 PM"), so no sessions are booked. Set the day and time on the admin class page.`,
        });
      } else if (!plan.ok && plan.reason === "outside-availability") {
        issues.push({
          severity: "urgent",
          kind: "schedule-outside-availability",
          classId: klass.id,
          className: name,
          detail:
            `The class time (${klass.schedulePreference ?? ""}, Kabul) is outside ${klass.teacher?.name ?? "the teacher"}'s ` +
            `available hours, so no sessions are booked. Change the class time or the teacher's hours.`,
        });
      }
    }
  }

  // Sessions about to run without a way in. The scheduler retries missing
  // links, but if Google is not connected at all it never succeeds; staff can
  // then paste a link by hand on the admin class page.
  const linkless = await prisma.session.findMany({
    where: {
      startTime: { gte: new Date(), lte: hoursAhead(LINK_WINDOW_HOURS) },
      cancelled: false,
      OR: [{ meetLink: null }, { meetLinkStatus: "FAILED" }],
    },
    select: {
      startTime: true,
      meetLinkStatus: true,
      class: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  for (const session of linkless) {
    issues.push({
      severity: "urgent",
      kind: "missing-meet-link",
      classId: session.class.id,
      className: session.class.name.trim(),
      detail:
        `Session on ${session.startTime.toISOString().replace("T", " ").slice(0, 16)} UTC ` +
        `has no joining link (${session.meetLinkStatus}).`,
    });
  }

  // Urgent first; the digest is read top-down and may be skimmed.
  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "urgent" ? -1 : 1));
}
