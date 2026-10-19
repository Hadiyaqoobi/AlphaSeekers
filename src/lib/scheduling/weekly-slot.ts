/**
 * The weekly class slot ("Tue 6:00 PM", Kabul wall clock) and the single rule the
 * auto-scheduler uses to decide whether it may book it.
 *
 * A class can meet on several days at the same time: "Tue, Thu, Fri 6:00 PM" is
 * one slot per day, and each day is booked as its own session (2026-10-19). A
 * single day is still stored as "Tue 6:00 PM", so classes posted before then read
 * exactly as they did.
 *
 * Pure functions only (no database), so the rule is unit-testable and the
 * scheduler, the class-create API, the teacher setup page and the class-health
 * digest all apply exactly the same logic.
 *
 * THE RULE (AUTO classes):
 *   1. The class runs at the day and time staff chose when they posted it. That
 *      time is the time used. The scheduler never moves a class to another day
 *      or hour.
 *   2. The teacher's saved hours never block booking. Decided by the
 *      organisation on 2026-10-14: staff set the date and time of every class
 *      and the teacher only receives the Meet link. The hours are shown to staff
 *      in the class form as a hint (green fits, orange outside); they used to
 *      refuse any time outside them, which silently left a class with no
 *      sessions. (This replaces both the 2026-04-19 rule that refused to book
 *      without availability and the rule that booked only inside it.)
 *   3. If the slot would overlap another of the teacher's sessions, nothing is
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

/** `slots` is every day the class meets, Sunday first; `slot` is the first of them. */
export type SlotPlan = { ok: true; slot: WeeklySlot; slots: WeeklySlot[] } | { ok: false; reason: SlotProblem };

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

const DAY_TOKEN = /^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?$/i;

/**
 * STRICT parse of one or more days sharing one time: "Tue, Thu, Fri 6:00 PM",
 * "Tue/Thu 18:00", "Tuesday and Thursday 6:00 pm", or a single "Tue 6:00 PM".
 * Returns one slot per day, Sunday first, duplicates dropped; null if any part
 * is not a day or the time is unreadable.
 */
export function parseWeeklySlotsStrict(text: string | null | undefined): WeeklySlot[] | null {
  if (!text) return null;
  const match = text.trim().match(/^(.+?)\s+(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  const tokens = match[1].split(/\s*(?:,|\/|&|\band\b|\s)\s*/i).filter(Boolean);
  if (tokens.length === 0 || !tokens.every((token) => DAY_TOKEN.test(token))) return null;
  const hour = toHour(match[2], match[4]);
  const minute = Number(match[3]);
  if (hour === null || minute > 59) return null;
  const days = Array.from(new Set(tokens.map((token) => DAY_INDEX[token.slice(0, 3).toLowerCase()]))).sort(
    (a, b) => a - b,
  );
  return days.map((dayOfWeek) => ({ dayOfWeek, hour, minute }));
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

/**
 * Every day a stored class time names: the strict multi-day form, else the
 * lenient single-day reading of older free text (still one day: "Saturdays to
 * Thursdays" was never booked as a range, and is not now).
 */
export function parseStoredWeeklySlots(text: string | null | undefined): WeeklySlot[] | null {
  const many = parseWeeklySlotsStrict(text);
  if (many) return many;
  const one = parseStoredWeeklySlot(text);
  return one ? [one] : null;
}

/** Canonical stored form, e.g. "Tue 6:00 PM" (what the scheduler and pages read). */
export function formatWeeklySlot(slot: WeeklySlot): string {
  const period = slot.hour >= 12 ? "PM" : "AM";
  const hour12 = slot.hour % 12 === 0 ? 12 : slot.hour % 12;
  return `${DAY_ABBREVIATIONS[slot.dayOfWeek]} ${hour12}:${String(slot.minute).padStart(2, "0")} ${period}`;
}

/** Canonical stored form of several days at one time: "Tue, Thu, Fri 6:00 PM". */
export function formatWeeklySlots(slots: WeeklySlot[]): string {
  const days = Array.from(new Set(slots.map((slot) => slot.dayOfWeek))).sort((a, b) => a - b);
  const time = formatWeeklySlot(slots[0]).split(" ").slice(1).join(" ");
  return `${days.map((day) => DAY_ABBREVIATIONS[day]).join(", ")} ${time}`;
}

/** Build a slot from the form's separate day ("Tue") and 24h time ("18:00") fields. */
export function slotFromDayAndTime(day: string, time: string): WeeklySlot | null {
  return parseWeeklySlotStrict(`${day} ${time}`);
}

/** The same for the form's ticked days (["Tue", "Thu"]) and one time; null if none is ticked. */
export function slotsFromDaysAndTime(days: string[], time: string): WeeklySlot[] | null {
  if (days.length === 0) return null;
  return parseWeeklySlotsStrict(`${days.join(", ")} ${time}`);
}

/**
 * How far either side of a weekly occurrence a session still counts as that
 * occurrence: half a week for a one-day class (neighbouring weeks never collide),
 * and half the shortest gap between its days for a several-day class, so
 * Thursday's session is never mistaken for Tuesday's.
 */
export function occurrenceHalfWindowMs(slots: WeeklySlot[]): number {
  const HALF_WEEK = 3.5 * 24 * 60 * 60 * 1000;
  const days = Array.from(new Set(slots.map((slot) => slot.dayOfWeek))).sort((a, b) => a - b);
  if (days.length < 2) return HALF_WEEK;
  let shortestGapDays = 7;
  days.forEach((day, index) => {
    const next = index + 1 < days.length ? days[index + 1] : days[0] + 7;
    shortestGapDays = Math.min(shortestGapDays, next - day);
  });
  return (shortestGapDays * 24 * 60 * 60 * 1000) / 2;
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
export function planAutoSlot(input: { schedulePreference: string | null | undefined }): SlotPlan {
  const slots = parseStoredWeeklySlots(input.schedulePreference);
  if (!slots) return { ok: false, reason: "unparseable" };
  // Staff's time is the time (rules 1-2), whatever hours the teacher saved.
  return { ok: true, slot: slots[0], slots };
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
