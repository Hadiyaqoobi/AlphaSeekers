/**
 * Pure helpers for the live-session page.
 * Client-safe (no imports).
 */

/** How far either side of a session the teacher roster keeps refreshing. */
export const LIVE_POLL_MARGIN_MS = 15 * 60 * 1000;

/**
 * Should the teacher/admin roster poll right now?
 *
 * Every poll is a database query. A teacher who leaves the tab open overnight
 * used to keep the (scale-to-zero) database awake all night, 20 s at a time.
 * Poll only while the tab is visible AND within 15 minutes of the session
 * window (from 15 min before start to 15 min after end).
 */
export function shouldPollLive(
  now: number,
  startTime: string | number | Date,
  endTime: string | number | Date,
  visible: boolean,
): boolean {
  if (!visible) return false;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return now >= start - LIVE_POLL_MARGIN_MS && now <= end + LIVE_POLL_MARGIN_MS;
}

export type LiveAccessReason = "cancelled" | "notEnrolled" | "notStarted" | "ended" | "generic";

/**
 * Map a refused session-access result to a translation key.
 *
 * src/lib/session-access.ts returns an English `message` and no code, so the
 * known messages are matched here; anything unrecognised gets the generic
 * (translated) reason rather than raw English.
 */
export function liveAccessReason(status: number, message: string | null | undefined): LiveAccessReason {
  if (status === 410) return "cancelled";
  const m = (message ?? "").toLowerCase();
  if (m.includes("not enrolled")) return "notEnrolled";
  if (m.includes("hasn't started") || m.includes("has not started")) return "notStarted";
  if (m.includes("has ended")) return "ended";
  return "generic";
}

/**
 * Pull summary text out of the summary API, whichever shape it arrives in:
 * POST generate → `draft: string`; GET → `draft: { content }` and
 * `published: { content }`; older/other shapes may use `summary` or `content`.
 */
export function readSummaryText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() ? value : null;
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    for (const key of ["content", "summary"]) {
      if (typeof v[key] === "string" && (v[key] as string).trim()) return v[key] as string;
    }
  }
  return null;
}
