/**
 * Instructor-managed session scheduling.
 *
 * These helpers let an instructor set/confirm the exact date & time of a class
 * session themselves (MANUAL scheduling), as opposed to the availability-driven
 * auto-scheduler. Each created/rescheduled session gets a Meet link generated the
 * same way the auto-scheduler does, and enrolled students are notified via the
 * durable event bus (session.scheduled / session.rescheduled → the worker).
 *
 * Authorization is the caller's responsibility (routes verify the acting user
 * owns the class or holds classes.edit); these functions assume an authorized
 * caller and operate on the class's own teacher for Meet-link generation.
 */

import { MeetLinkStatus } from "@prisma/client";

import { emit } from "@/lib/events/bus";
import { generateMeetLink, updateMeetEvent } from "@/lib/integrations/meet";
import { hasTeacherConflict } from "@/lib/platform/db-store";
import { prisma } from "@/lib/prisma";

export type SchedulingResult = { ok: true; sessionId: string } | { ok: false; error: string };

function toMeetStatus(status: "GENERATED" | "PENDING" | "FAILED"): MeetLinkStatus {
  if (status === "FAILED") return MeetLinkStatus.FAILED;
  if (status === "PENDING") return MeetLinkStatus.PENDING;
  return MeetLinkStatus.GENERATED;
}

function normalizeDuration(minutes: number | null | undefined, fallback: number | null | undefined): number {
  const value = minutes ?? fallback ?? 60;
  return Math.min(Math.max(Math.round(value), 15), 8 * 60);
}

function isValidFutureLeeway(start: Date): boolean {
  // Reject clearly-invalid dates. Allow a small grace window into the past so a
  // teacher scheduling "now" is not rejected by clock skew, and reject times
  // absurdly far in the future (more than 12 months ahead).
  if (Number.isNaN(start.getTime())) return false;
  if (start.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) return false;
  return start.getTime() > Date.now() - 5 * 60 * 1000;
}

/** Create a new session for a class at an explicit instructor-chosen time. */
export async function createManualSession(input: {
  classId: string;
  startTime: Date;
  durationMinutes?: number;
}): Promise<SchedulingResult> {
  if (!isValidFutureLeeway(input.startTime)) {
    return { ok: false, error: "Session time must be a valid time that is not in the past" };
  }

  const klass = await prisma.class.findUnique({
    where: { id: input.classId },
    select: { id: true, name: true, teacherId: true, durationMinutes: true },
  });
  if (!klass) return { ok: false, error: "Class not found" };

  const duration = normalizeDuration(input.durationMinutes, klass.durationMinutes);
  const endTime = new Date(input.startTime.getTime() + duration * 60_000);

  if (await hasTeacherConflict(klass.teacherId, input.startTime, endTime)) {
    return { ok: false, error: "That time overlaps another of your sessions" };
  }

  const meet = await generateMeetLink(klass.name, input.startTime.toISOString(), {
    endIso: endTime.toISOString(),
    teacherId: klass.teacherId,
  });

  const session = await prisma.session.create({
    data: {
      classId: klass.id,
      startTime: input.startTime,
      endTime,
      meetLink: meet.link,
      meetLinkStatus: toMeetStatus(meet.status),
      googleEventId: meet.eventId,
      googleCalendarId: meet.calendarId,
      cancelled: false,
      confirmedAt: new Date(),
    },
    select: { id: true },
  });

  await emitScheduleEvent("session.scheduled", session.id);
  return { ok: true, sessionId: session.id };
}

/** Move an existing session to a new instructor-chosen time (regenerates Meet). */
export async function rescheduleSession(input: {
  sessionId: string;
  startTime: Date;
  durationMinutes?: number;
}): Promise<SchedulingResult> {
  if (!isValidFutureLeeway(input.startTime)) {
    return { ok: false, error: "Session time must be a valid time that is not in the past" };
  }

  const session = await prisma.session.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      cancelled: true,
      meetLink: true,
      googleEventId: true,
      googleCalendarId: true,
      class: { select: { name: true, teacherId: true, durationMinutes: true } },
    },
  });
  if (!session) return { ok: false, error: "Session not found" };
  if (session.cancelled) return { ok: false, error: "Cannot reschedule a cancelled session" };

  const duration = normalizeDuration(input.durationMinutes, session.class.durationMinutes);
  const endTime = new Date(input.startTime.getTime() + duration * 60_000);

  if (await hasTeacherConflict(session.class.teacherId, input.startTime, endTime, session.id)) {
    return { ok: false, error: "That time overlaps another of your sessions" };
  }

  // If this session already has a backing Google Calendar event, PATCH it (which
  // preserves the same Meet link) rather than minting a brand-new link. Only a
  // first-time link goes through the create path.
  const meet = session.googleEventId
    ? await updateMeetEvent({
        eventId: session.googleEventId,
        calendarId: session.googleCalendarId ?? undefined,
        teacherId: session.class.teacherId,
        className: session.class.name,
        startIso: input.startTime.toISOString(),
        endIso: endTime.toISOString(),
      })
    : await generateMeetLink(session.class.name, input.startTime.toISOString(), {
        endIso: endTime.toISOString(),
        teacherId: session.class.teacherId,
      });

  await prisma.session.update({
    where: { id: session.id },
    data: {
      startTime: input.startTime,
      endTime,
      // Preserve the existing link/event ids if the result did not return them
      // (e.g. a defensive null on a PATCH that kept the same conference).
      meetLink: meet.link ?? session.meetLink,
      meetLinkStatus: toMeetStatus(meet.status),
      googleEventId: meet.eventId ?? session.googleEventId,
      googleCalendarId: meet.calendarId ?? session.googleCalendarId,
      confirmedAt: new Date(),
    },
  });

  await emitScheduleEvent("session.rescheduled", session.id);
  return { ok: true, sessionId: session.id };
}

/** Accept an auto-proposed session's time as-is (marks it confirmed). */
export async function confirmSession(sessionId: string): Promise<SchedulingResult> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, cancelled: true },
  });
  if (!session) return { ok: false, error: "Session not found" };
  if (session.cancelled) return { ok: false, error: "Session is cancelled" };

  await prisma.session.update({ where: { id: sessionId }, data: { confirmedAt: new Date() } });
  return { ok: true, sessionId };
}

async function emitScheduleEvent(event: "session.scheduled" | "session.rescheduled", sessionId: string): Promise<void> {
  try {
    await emit(event, { sessionId, kind: event === "session.scheduled" ? "scheduled" : "rescheduled" });
  } catch (error) {
    // Never let a notification-enqueue failure roll back the schedule change.
    console.error(`[scheduling] failed to emit ${event} for ${sessionId}`, error);
  }
}
