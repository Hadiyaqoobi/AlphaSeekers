/**
 * Client-side mirror of the server password rule (src/app/api/me/password,
 * the register and class-join routes): at least 8 characters, at most 72, with
 * at least one letter and one number. The server stays the authority; this
 * only lets the form say what is wrong before a round trip on a slow line.
 *
 * Client-safe (no imports).
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordProblem = "tooShort" | "tooLong" | "needsLetterAndNumber";

export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (password.length > PASSWORD_MAX_LENGTH) return "tooLong";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "needsLetterAndNumber";
  return null;
}
