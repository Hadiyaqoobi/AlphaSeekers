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
