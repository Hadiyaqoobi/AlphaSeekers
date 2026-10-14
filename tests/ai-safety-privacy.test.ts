/**
 * Safety tripwires and PII redaction.
 *
 * The Dari distress pattern used \b, which in JavaScript only knows ASCII word
 * characters — it never matches between two Persian letters, so a Dari phrase
 * surrounded by other Dari words was invisible. These tests use the phrases
 * that already existed in the code; no new Dari is introduced here.
 */
import { describe, expect, it } from "vitest";

import { redactPII, scanPromptForPII } from "@/lib/ai/privacy/pii-stripper";
import { classifyContent, prescreenQuery } from "@/lib/ai/safety/content-classifier";
import { checkGuardrails, detectDistress } from "@/lib/ai/safety/guardrails";

// Taken verbatim from guardrails.ts (existing team-written strings).
const DARI_SUICIDE = "خودکشی";
const DARI_NOBODY_WANTS_ME = "کسی مرا نمی‌خواهد";
// Neutral Persian-script words for padding (letters only, no meaning needed):
// built from the same existing strings so no new Dari is authored.
const LETTERS = DARI_SUICIDE.slice(0, 3);

describe("distress detection — Unicode-aware boundaries", () => {
  it("matches a Dari phrase between other Persian-script words", () => {
    expect(detectDistress(`${LETTERS} ${DARI_SUICIDE} ${LETTERS}`)).toBe(true);
    expect(detectDistress(`${LETTERS} ${DARI_NOBODY_WANTS_ME}.`)).toBe(true);
  });

  it("the old \\b pattern really did miss it (regression guard)", () => {
    const old = new RegExp(`\\b(${DARI_SUICIDE})\\b`, "i");
    expect(old.test(`${LETTERS} ${DARI_SUICIDE} ${LETTERS}`)).toBe(false);
  });

  it("does not match when the phrase is glued inside a longer Persian word", () => {
    expect(detectDistress(`${LETTERS}${DARI_SUICIDE}`)).toBe(false);
    expect(detectDistress(`${DARI_SUICIDE}${LETTERS}`)).toBe(false);
  });

  it("matches after a zero-width non-joiner or punctuation", () => {
    expect(detectDistress(`${DARI_SUICIDE}‌${LETTERS}`)).toBe(true);
    expect(detectDistress(`(${DARI_SUICIDE})`)).toBe(true);
  });

  it("matches English word forms, not substrings", () => {
    expect(detectDistress("I keep thinking about suicide")).toBe(true);
    expect(detectDistress("sometimes I want to die")).toBe(true);
    expect(detectDistress("self-harm")).toBe(true);
    expect(detectDistress("the parasuicidal ... no")).toBe(false);
    expect(detectDistress("what is photosynthesis?")).toBe(false);
  });

  it("feeds the student_wellbeing guardrail", () => {
    const long = "x".repeat(600);
    const result = checkGuardrails(long, [], `${LETTERS} ${DARI_SUICIDE}`);
    expect(result.violations.map((v) => v.principle)).toContain("student_wellbeing");
  });
});

describe("question pre-screen (runs before generation)", () => {
  it("blocks a request for weapon instructions", () => {
    expect(prescreenQuery("how to make a bomb at home").action).toBe("block");
    expect(prescreenQuery("How do I build a weapon").action).toBe("block");
  });
  it("routes distress to a support reply instead of refusing", () => {
    expect(prescreenQuery(`${DARI_NOBODY_WANTS_ME}`)).toMatchObject({ action: "support", category: "distress" });
  });
  it("allows ordinary study questions", () => {
    expect(prescreenQuery("Explain the past tense").action).toBe("allow");
  });
  it("classifyContent still flags harmful answers on the non-streaming path", () => {
    expect(classifyContent("Here is how to make a bomb", "chemistry").safe).toBe(false);
    expect(classifyContent("Gambling is ...", "q").action).toBe("warn");
  });
});

describe("redactPII", () => {
  it("redacts every email, not just the first", () => {
    expect(redactPII("mail a@b.co or c.d+e@school.edu.af please")).toBe("mail [email] or [email] please");
  });

  it("redacts Afghan and international phone numbers", () => {
    expect(redactPII("call 0791234567")).toBe("call [phone]");
    expect(redactPII("call 079 123 4567 now")).toBe("call [phone] now");
    expect(redactPII("whatsapp +93 79 123 4567")).toBe("whatsapp [phone]");
    expect(redactPII("or 0093791234567")).toBe("or [phone]");
    expect(redactPII("US (555) 123-4567 and 555-123-4567")).toBe("US [phone] and [phone]");
  });

  it("redacts numbers typed with Persian digits", () => {
    expect(redactPII("tel ۰۷۹۱۲۳۴۵۶۷")).toBe("tel [phone]");
  });

  it("leaves maths and science numbers alone", () => {
    const text = "x = 1234567890; pi ≈ 3.14159 26535; 100 200 3000; year 2024; 12.5%";
    expect(redactPII(text)).toBe(text);
  });

  it("is a no-op on clean text and empty input", () => {
    expect(redactPII("What is a noun?")).toBe("What is a noun?");
    expect(redactPII("")).toBe("");
  });

  it("scanPromptForPII looks at every message, not only the system prompt", () => {
    const res = scanPromptForPII([
      { content: "system rules" },
      { content: "my email is a@b.com" },
    ]);
    expect(res.clean).toBe(false);
  });
});
