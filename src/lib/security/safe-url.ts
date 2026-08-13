/**
 * Guard for any user-supplied URL that later ends up in an href.
 *
 * Class materials and library resources are rendered as links straight from the
 * database, so an unvalidated value is stored XSS: `javascript:...` in a link a
 * student clicks runs in their session. Only http(s) is ever safe here.
 */
export const MAX_URL_LENGTH = 2000;

export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  // Explicit allowlist: everything else (javascript:, data:, vbscript:, file:,
  // blob:) is rejected rather than filtered, so a new scheme cannot slip in.
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/** Normalised form to persist, or null when the input is not a safe URL. */
export function normaliseHttpUrl(value: unknown): string | null {
  return isSafeHttpUrl(value) ? value.trim() : null;
}
