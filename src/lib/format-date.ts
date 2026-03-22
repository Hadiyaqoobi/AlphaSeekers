const DEFAULT_TIMEZONE = "Asia/Kabul";

export function formatDateTime(
  date: string | Date,
  locale: string,
  timezone?: string | null,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return d.toLocaleString(locale === "fa" ? "fa-AF" : "en-US", {
      timeZone: timezone || DEFAULT_TIMEZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString();
  }
}

export function formatDate(
  date: string | Date,
  locale: string,
  timezone?: string | null,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return d.toLocaleDateString(locale === "fa" ? "fa-AF" : "en-US", {
      timeZone: timezone || DEFAULT_TIMEZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d.toLocaleDateString();
  }
}
