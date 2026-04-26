// Email validation shared between the registration API and the client form.
//
// `z.string().email()` only enforces RFC 5322 syntax — it accepts garbage like
// "me@gmail.con". UAT 2026-04-26 (Tester 1, Shahla) flagged this. We layer a
// TLD shape check + a small typo blocklist on top.
//
// The validator returns a `code` (and optional typoTld). The English fallback
// `message` is used by the API for non-localized clients. The bilingual
// register form translates via `register.email{Invalid|TldMissing|TldShape|TldTypo}`.

const TLD_RX = /\.[A-Za-z]{2,}$/;

// Common typos for popular domains. Lowercase. Curated from real-world signups.
const TYPO_TLDS = new Set([
  "con",
  "cmo",
  "cm",
  "vom",
  "comm",
  "coom",
  "cim",
  "cpm",
  "lh",
  "ney",
  "nte",
  "rog",
  "ogr",
]);

export type EmailValidationCode =
  | "INVALID_FORMAT"
  | "TLD_MISSING"
  | "TLD_SHAPE"
  | "TLD_TYPO";

export type EmailValidationResult =
  | { ok: true }
  | { ok: false; code: EmailValidationCode; message: string; typoTld?: string };

export function validateEmailStrict(input: string): EmailValidationResult {
  const email = input.trim().toLowerCase();

  // Single @ and at least one dot in the domain.
  const atIdx = email.indexOf("@");
  if (atIdx < 1 || atIdx !== email.lastIndexOf("@") || atIdx === email.length - 1) {
    return { ok: false, code: "INVALID_FORMAT", message: "Please enter a valid email address." };
  }

  const domain = email.slice(atIdx + 1);
  if (!domain.includes(".")) {
    return { ok: false, code: "TLD_MISSING", message: "Email is missing a domain extension (for example .com)." };
  }

  if (!TLD_RX.test(domain)) {
    return { ok: false, code: "TLD_SHAPE", message: "Email domain extension looks wrong. Use letters only, like .com or .org." };
  }

  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (TYPO_TLDS.has(tld)) {
    return {
      ok: false,
      code: "TLD_TYPO",
      typoTld: tld,
      message: `That domain extension (.${tld}) doesn't look right. Did you mean .com?`,
    };
  }

  return { ok: true };
}
