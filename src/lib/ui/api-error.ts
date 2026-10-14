/**
 * Turn an API error body into a message in the reader's language.
 *
 * API routes answer with `{ code, message }` where `message` is ENGLISH. On the
 * Dari site that English used to be shown verbatim (`body.message ?? t(...)`),
 * so students read English errors. The rule now: translate by `code` from a map
 * of already-translated strings, otherwise show a translated generic fallback.
 * The server's `message` is never shown.
 *
 * Client-safe (no imports).
 */

export type ApiErrorBody = { code?: unknown; message?: unknown } | null | undefined;

/** Read a JSON error body without throwing (empty / non-JSON bodies → null). */
export async function readErrorBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body = (await response.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Pick the translated message for `body.code`, or `fallback`.
 * `byCode` values must already be translated (pass `t("...")` results).
 */
export function messageForCode(
  body: ApiErrorBody,
  byCode: Record<string, string>,
  fallback: string,
): string {
  const code = body && typeof body.code === "string" ? body.code : null;
  if (code && Object.prototype.hasOwnProperty.call(byCode, code)) return byCode[code];
  return fallback;
}
