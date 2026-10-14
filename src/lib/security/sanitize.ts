/**
 * Strip HTML/XML tags from user-supplied text.
 *
 * Defends against stored XSS by ensuring user-controlled strings (names,
 * titles, descriptions) cannot contain markup that some downstream renderer
 * might interpret literally. React escapes strings in JSX by default, but
 * any future use of `dangerouslySetInnerHTML` or markdown-passthrough on a
 * user-controlled field would re-introduce risk. Stripping at the API
 * boundary closes the door regardless of how the value is later rendered.
 *
 * Usage in Zod schemas:
 *   name: z.string().trim().min(1).max(120).transform(stripHtml).pipe(z.string().min(1))
 *
 * The trailing `.pipe(z.string().min(1))` re-asserts non-empty after
 * stripping, in case the entire input was markup.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Persian (U+06F0-06F9) and Arabic-Indic (U+0660-0669) digits → 0-9. Phones set
 * to Dari type these by default, so any numeric code a person reads off a
 * screen (a check-in code, a one-time number) must be normalised before it is
 * compared — otherwise the right answer is refused as "invalid format".
 */
export function normaliseDigits(value: string): string {
  return value.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}
