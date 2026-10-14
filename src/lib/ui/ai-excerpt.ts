/**
 * Fit a student's text into the AI helper's question limit.
 *
 * The AI route refuses a question longer than 1,000 characters, and the
 * helper's question is an instruction PLUS the student's text, so a long post
 * used to fail outright. Send the current selection when there is one,
 * otherwise the start of the text, cut to whatever room the instruction leaves.
 *
 * Client-safe (no imports).
 */

export const AI_QUESTION_MAX = 1000;

export function aiExcerpt(
  fullText: string,
  budget: number,
  selection?: { start: number; end: number } | null,
): { text: string; trimmed: boolean } {
  const room = Math.max(0, budget);
  let text = fullText;
  if (selection && selection.end > selection.start) {
    const picked = fullText.slice(selection.start, selection.end);
    if (picked.trim()) text = picked;
  }
  if (text.length <= room) return { text, trimmed: false };
  return { text: text.slice(0, room), trimmed: true };
}
