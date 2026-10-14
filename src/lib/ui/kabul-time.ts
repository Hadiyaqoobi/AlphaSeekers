/**
 * Deterministic Kabul-time helpers for UI rendering.
 *
 * Every formatter pins BOTH the time zone (Asia/Kabul) and the locale, so the
 * server (UTC on Render) and the student's phone (any zone, any language)
 * produce the same string. That is what stops the SSR/client hydration
 * mismatch, and what stops a class at 16:00 Kabul showing as 11:30 on the
 * dashboard because the server clock is UTC.
 *
 * Same locale mapping as src/lib/format-date.ts (fa → fa-AF, else en-US).
 * Client-safe (no imports).
 */

export const KABUL_TIME_ZONE = "Asia/Kabul";

function intlLocale(locale: string): string {
  return locale === "fa" ? "fa-AF" : "en-US";
}

function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** Hour of day (0-23) in Kabul. */
export function kabulHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: KABUL_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  const n = Number.parseInt(hour, 10);
  return Number.isFinite(n) ? n % 24 : now.getUTCHours();
}

export type DayPart = "morning" | "afternoon" | "evening";

/** Morning before 12:00, afternoon before 18:00, evening after — Kabul time. */
export function kabulDayPart(now: Date = new Date()): DayPart {
  const hour = kabulHour(now);
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** "14:05" style time in Kabul. */
export function formatKabulTime(value: string | Date, locale: string): string {
  return toDate(value).toLocaleTimeString(intlLocale(locale), {
    timeZone: KABUL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Tuesday, October 14" style date in Kabul. */
export function formatKabulLongDate(value: string | Date, locale: string): string {
  return toDate(value).toLocaleDateString(intlLocale(locale), {
    timeZone: KABUL_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
