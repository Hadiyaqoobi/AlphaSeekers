/**
 * Translation parity guard.
 *
 * Two failure modes this catches, both of which shipped silently before:
 *
 *  1. A key exists in one locale and not the other. next-intl then throws at
 *     RENDER time, not build time, so `npm run build` passes and the page 500s
 *     in production for one language only.
 *
 *  2. A key exists in fa.json but its value is the English string copied over.
 *     Nothing errors — Dari users just quietly read English. As of 2026-09-14
 *     this had happened to 214 keys (the support queue, teacher setup, password
 *     reset, the contact page and the admin user/class screens were entirely
 *     English for Dari readers).
 *
 * Case 2 is a ratchet, not a hard gate: the existing 214 are listed in
 * src/i18n/untranslated-baseline.json so CI stays green, but a NEW untranslated
 * key fails the build. The debt can only shrink.
 *
 * Do NOT clear the baseline by machine-translating it. Dari on this platform is
 * written by a native speaker on the team; that rule covers every string,
 * including one-word buttons and error text.
 */
import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fa from "../messages/fa.json";
import identicalByDesign from "../src/i18n/identical-by-design.json";
import baseline from "../src/i18n/untranslated-baseline.json";

type Nested = { [key: string]: string | Nested };

function flatten(obj: Nested, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v as Nested, key, out);
    else out[key] = v as string;
  }
  return out;
}

const EN = flatten(en as unknown as Nested);
const FA = flatten(fa as unknown as Nested);
const ALLOWED_IDENTICAL = new Set(identicalByDesign.keys);
const BASELINE = new Set(baseline.keys);

/** Keys whose Dari value is still the English string. */
function untranslatedKeys(): string[] {
  return Object.keys(EN).filter(
    (k) => k in FA && EN[k] === FA[k] && typeof EN[k] === "string" && !ALLOWED_IDENTICAL.has(k),
  );
}

describe("i18n parity between en.json and fa.json", () => {
  it("has no key present in English but missing from Dari", () => {
    const missing = Object.keys(EN).filter((k) => !(k in FA));
    expect(missing, `Missing from messages/fa.json:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("has no key present in Dari but missing from English", () => {
    const extra = Object.keys(FA).filter((k) => !(k in EN));
    expect(extra, `Present in fa.json but not en.json:\n  ${extra.join("\n  ")}`).toEqual([]);
  });

  it("has no interpolation placeholders that differ between locales", () => {
    const mismatched: string[] = [];
    for (const key of Object.keys(EN)) {
      if (!(key in FA)) continue;
      const names = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");
      if (names(EN[key]) !== names(FA[key])) {
        mismatched.push(`${key}: en={${names(EN[key])}} fa={${names(FA[key])}}`);
      }
    }
    expect(mismatched, `Placeholder mismatch (will render a literal {token}):\n  ${mismatched.join("\n  ")}`).toEqual([]);
  });

  it("introduces no NEW untranslated Dari string", () => {
    const regressions = untranslatedKeys().filter((k) => !BASELINE.has(k));
    expect(
      regressions,
      `These keys were added to fa.json with the English text still in place:\n  ${regressions.join("\n  ")}\n\n` +
        `Ask the team for the Dari (see messages/TRANSLATION_NEEDED.md). Do not machine-translate it. ` +
        `If a key is genuinely meant to read the same in both languages (a brand or product name), ` +
        `add it to src/i18n/identical-by-design.json instead.`,
    ).toEqual([]);
  });

  it("keeps the untranslated baseline honest (no stale entries)", () => {
    // A key listed as untranslated that is now translated should be removed from
    // the baseline, so the number always reflects the real remaining debt.
    const stale = [...BASELINE].filter((k) => !untranslatedKeys().includes(k));
    expect(
      stale,
      `Now translated — delete from src/i18n/untranslated-baseline.json:\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });
});
