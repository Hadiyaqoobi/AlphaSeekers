/**
 * Class registration cutoff — the last moment a student may REQUEST to join.
 *
 * Null means open indefinitely, which is how every class behaved before the
 * field existed, so nothing about existing classes changes.
 *
 * ── Why a date-only value becomes END of day ────────────────────────────────
 * The form uses <input type="date">, which submits "YYYY-MM-DD". `new Date()`
 * parses that as UTC MIDNIGHT — the *start* of the day. Storing that would mean
 * a class whose deadline reads "1 October" actually stopped accepting students
 * at the end of 30 September, which is not what anyone setting the date means.
 * (The Opportunity model has this exact behaviour; it is not copied here.)
 *
 * So a date-only value is stored as 23:59:59.999 UTC on that day: the whole of
 * the named day is still open. Kabul is UTC+4:30, so for the students this
 * platform actually serves that lands at ~04:29 the following morning local
 * time — slightly generous rather than cutting anyone off early, which is the
 * safe direction to err for a deadline.
 *
 * A full ISO timestamp is honoured exactly as given, so a future "close at a
 * specific time" UI needs no change here.
 */

export type DeadlineParse =
  | { ok: true; value: Date | null }
  | { ok: false; message: string };

/** "YYYY-MM-DD" with nothing else. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse whatever arrived on the wire into a Date, null (explicitly cleared), or
 * a validation failure. Rejects rather than silently dropping a bad value: a
 * deadline that quietly failed to save is worse than an error message, because
 * the teacher believes registration is closing and it is not.
 */
export function parseRegistrationDeadline(value: unknown): DeadlineParse {
  // Absent = "don't change / not supplied"; explicit null or "" = clear it.
  if (value === undefined) return { ok: true, value: null };
  if (value === null || value === "") return { ok: true, value: null };

  if (typeof value !== "string") {
    return { ok: false, message: "registrationDeadline must be a date string." };
  }

  const raw = value.trim();
  if (raw === "") return { ok: true, value: null };

  if (DATE_ONLY.test(raw)) {
    const parsed = new Date(`${raw}T23:59:59.999Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, message: "registrationDeadline is not a valid date." };
    }
    return { ok: true, value: parsed };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, message: "registrationDeadline is not a valid date." };
  }
  return { ok: true, value: parsed };
}

/**
 * Has registration closed? Null/undefined is always open.
 *
 * Accepts the ISO string that read paths serialise as well as a Date, so UI and
 * server can ask the same question of the same value and never disagree.
 */
export function isRegistrationClosed(
  deadline: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!deadline) return false;
  const at = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(at.getTime())) return false; // unreadable value never locks anyone out
  return at.getTime() < now.getTime();
}

/** The value an <input type="date"> needs to show an existing deadline. */
export function toDateInputValue(deadline: string | Date | null | undefined): string {
  if (!deadline) return "";
  const at = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(at.getTime())) return "";
  return at.toISOString().slice(0, 10);
}
