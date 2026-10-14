/**
 * The weekly class slot ("Tue 6:00 PM", Kabul wall clock) and the single rule the
 * auto-scheduler uses to decide whether it may book it.
 *
 * Pure functions only (no database), so the rule is unit-testable and the
 * scheduler, the class-create API, the teacher setup page and the class-health
 * digest all apply exactly the same logic.
 *
 * THE RULE (AUTO classes):
 *   1. The class runs at the day and time chosen when it was posted. That time is
 *      the time used. The scheduler never moves a class to another day or hour.
 *   2. It is booked only if the whole class (every 60-minute segment and the
 *      breaks between them) fits inside ONE of the teacher's availability windows
 *      on that day.
 *   3. A teacher with no availability at all gets nothing booked (QA 2026-04-19:
 *      never book a teacher into an hour they never agreed to). Availability is
 *      the teacher's consent to the posted time, so it stays required.
 *   4. If the slot would overlap another of the teacher's sessions, nothing is
 *      booked (the old code shifted the class by an hour up to eight times and
 *      then booked the overlap anyway).
 * When a class cannot be booked the reason is surfaced on the teacher setup page
 * and in the class-health digest instead of being guessed around.
 */

/** Asia/Kabul is UTC+04:30 all year (no DST). */
const KABUL_OFFSET_MS = (4 * 60 + 30) * 60_000;

export const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type WeeklySlot = {
  /** 0 = Sunday … 6 = Saturday, Asia/Kabul. */
  dayOfWeek: number;
  /** 0–23, Asia/Kabul wall clock. */
  hour: number;
  minute: number;
};

export type AvailabilityWindow = {
  dayOfWeek: number;
  /** Minutes after Kabul midnight. */
  startMinute: number;
  endMinute: number;
};

export type SlotProblem = "unparseable" | "no-availability" | "outside-availability";

export type SlotPlan = { ok: true; slot: WeeklySlot } | { ok: false; reason: SlotProblem };

const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function toHour(rawHour: string, period: string | undefined): number | null {
  let hour = Number(rawHour);
  if (!Number.isInteger(hour)) return null;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    const pm = period.toUpperCase() === "PM";
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
    return hour;
  }
  return hour >= 0 && hour <= 23 ? hour : null;
}

/**
 * STRICT parse, for new input from the class forms/API: "Tue 6:00 PM",
 * "Tuesday 18:00", "tue 6:00pm". Anything else returns null so the API can
 * answer 400 instead of silently defaulting (the old parser turned "6pm" or a
 * Dari schedule into Saturday 5:00 PM without telling anyone).
 */
export function parseWeeklySlotStrict(text: string | null | undefined): WeeklySlot | null {
  if (!text) return null;
  const match = text
    .trim()
    .match(/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  const hour = toHour(match[2], match[4]);
  const minute = Number(match[3]);
  if (hour === null || minute > 59) return null;
  return { dayOfWeek: DAY_INDEX[match[1].toLowerCase()], hour, minute };
}

/**
 * LENIENT parse, for schedule text already stored on older classes (e.g.
 * "7:00 AM to 8:00 AM, Saturdays to Thursdays"): the first day name and the first
 * clock time. Unlike the old parser there are NO defaults — if either part is
 * missing the class is reported as unreadable rather than booked on Saturday.
 */
export function parseStoredWeeklySlot(text: string | null | undefined): WeeklySlot | null {
  if (!text) return null;
  const strict = parseWeeklySlotStrict(text);
  if (strict) return strict;
  const day = text.match(/\b(sun|mon|tue|wed|thu|fri|sat)/i);
  const time = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!day || !time) return null;
  const hour = toHour(time[1], time[3]);
  const minute = Number(time[2]);
  if (hour === null || minute > 59) return null;
  return { dayOfWeek: DAY_INDEX[day[1].toLowerCase()], hour, minute };
}

/** Canonical stored form, e.g. "Tue 6:00 PM" (what the scheduler and pages read). */
export function formatWeeklySlot(slot: WeeklySlot): string {
  const period = slot.hour >= 12 ? "PM" : "AM";
  const hour12 = slot.hour % 12 === 0 ? 12 : slot.hour % 12;
  return `${DAY_ABBREVIATIONS[slot.dayOfWeek]} ${hour12}:${String(slot.minute).padStart(2, "0")} ${period}`;
}

/** Build a slot from the form's separate day ("Tue") and 24h time ("18:00") fields. */
export function slotFromDayAndTime(day: string, time: string): WeeklySlot | null {
  return parseWeeklySlotStrict(`${day} ${time}`);
}

/** Does [start, start+span) fit entirely inside one availability window on that day? */
export function slotFitsAvailability(
  slot: WeeklySlot,
  spanMinutes: number,
  availability: AvailabilityWindow[],
): boolean {
  const start = slot.hour * 60 + slot.minute;
  const end = start + spanMinutes;
  return availability.some(
    (window) => window.dayOfWeek === slot.dayOfWeek && window.startMinute <= start && end <= window.endMinute,
  );
}

/** Apply THE RULE (see file header) to one class. */
export function planAutoSlot(input: {
  schedulePreference: string | null | undefined;
  spanMinutes: number;
  availability: AvailabilityWindow[];
}): SlotPlan {
  const slot = parseStoredWeeklySlot(input.schedulePreference);
  if (!slot) return { ok: false, reason: "unparseable" };
  if (input.availability.length === 0) return { ok: false, reason: "no-availability" };
  if (!slotFitsAvailability(slot, input.spanMinutes, input.availability)) {
    return { ok: false, reason: "outside-availability" };
  }
  return { ok: true, slot };
}

/**
 * Total wall-clock minutes a class occupies: classes longer than 60 minutes run
 * as 60-minute Meet segments with a break between them (see db-store
 * buildSegmentWindows), so a 120-minute class occupies 130 minutes.
 */
export function classSpanMinutes(durationMinutes: number, segmentMinutes = 60, breakMinutes = 10): number {
  const normalized = Math.max(30, Math.floor(Number.isFinite(durationMinutes) ? durationMinutes : segmentMinutes));
  const segments = Math.max(1, Math.ceil(normalized / segmentMinutes));
  return normalized + (segments - 1) * breakMinutes;
}

/**
 * The live window for a session: the "Live session" page is only offered from a
 * little before the start until a little after the end.
 */
export function isWithinLiveWindow(
  session: { startTime: string | Date; endTime: string | Date },
  now: number = Date.now(),
  leadMinutes = 15,
  tailMinutes = 15,
): boolean {
  const start = new Date(session.startTime).getTime();
  const end = new Date(session.endTime).getTime();
  return now >= start - leadMinutes * 60_000 && now <= end + tailMinutes * 60_000;
}

/** Convert a Kabul wall-clock "YYYY-MM-DDTHH:mm" (datetime-local value) to a UTC Date. */
export function kabulLocalInputToDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi) - KABUL_OFFSET_MS;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Inverse of kabulLocalInputToDate: a UTC instant as a Kabul datetime-local value. */
export function dateToKabulLocalInput(date: Date): string {
  const local = new Date(date.getTime() + KABUL_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(
    local.getUTCHours(),
  )}:${pad(local.getUTCMinutes())}`;
}
