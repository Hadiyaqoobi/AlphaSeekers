/**
 * Digit normalisation for inputs typed on a Dari / Persian / Arabic keyboard.
 *
 * A phone set to Dari types Extended Arabic-Indic digits (U+06F0–U+06F9,
 * "۱۲۳۴"); an Arabic keyboard types Arabic-Indic digits (U+0660–U+0669,
 * "١٢٣٤"). Neither matches `\d` or `[0-9]`, so a plain `replace(/\D/g, "")`
 * silently deletes every digit a Dari user types. Convert first, then filter.
 *
 * Client-safe (no imports).
 */

const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;

/** Replace Persian and Arabic-Indic digits with ASCII 0-9; everything else is kept. */
export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const base = code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_INDIC_ZERO;
    return String(code - base);
  });
}

/** Normalise digits, drop every non-digit, and cap the length. */
export function digitsOnly(value: string, maxLength?: number): string {
  const digits = toLatinDigits(value).replace(/[^0-9]/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}
