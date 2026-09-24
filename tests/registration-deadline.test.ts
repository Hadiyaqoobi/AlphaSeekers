/**
 * Registration cutoff parsing and evaluation.
 *
 * The behaviour that actually matters to a teacher is the date-only case: they
 * type "1 October" and expect a student to still be able to join ON 1 October.
 * Parsing that as UTC midnight would close it a day early, silently.
 */
import { describe, expect, it } from "vitest";

import {
  isRegistrationClosed,
  parseRegistrationDeadline,
  toDateInputValue,
} from "@/lib/platform/registration-deadline";

describe("parseRegistrationDeadline", () => {
  it("keeps the whole named day open for a date-only value", () => {
    const parsed = parseRegistrationDeadline("2026-10-01");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value?.toISOString()).toBe("2026-10-01T23:59:59.999Z");
  });

  it("still allows a request late on the deadline day", () => {
    const parsed = parseRegistrationDeadline("2026-10-01");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // 22:00 UTC on the deadline day — the case a midnight parse would wrongly reject.
    expect(isRegistrationClosed(parsed.value, new Date("2026-10-01T22:00:00Z"))).toBe(false);
  });

  it("closes once the day is over", () => {
    const parsed = parseRegistrationDeadline("2026-10-01");
    if (!parsed.ok) return;
    expect(isRegistrationClosed(parsed.value, new Date("2026-10-02T00:00:00.001Z"))).toBe(true);
  });

  it("honours a full ISO timestamp exactly", () => {
    const parsed = parseRegistrationDeadline("2026-10-01T09:30:00.000Z");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value?.toISOString()).toBe("2026-10-01T09:30:00.000Z");
  });

  it("treats undefined, null and empty string as no deadline", () => {
    for (const input of [undefined, null, "", "   "]) {
      const parsed = parseRegistrationDeadline(input);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value).toBeNull();
    }
  });

  it("rejects an unparseable date instead of silently dropping it", () => {
    // Silently ignoring this would leave the teacher believing registration closes.
    for (const input of ["not-a-date", "2026-13-45", "yesterday"]) {
      expect(parseRegistrationDeadline(input).ok).toBe(false);
    }
  });

  it("rejects a non-string value", () => {
    expect(parseRegistrationDeadline(12345).ok).toBe(false);
    expect(parseRegistrationDeadline({}).ok).toBe(false);
  });
});

describe("isRegistrationClosed", () => {
  it("is open when no deadline is set", () => {
    expect(isRegistrationClosed(null)).toBe(false);
    expect(isRegistrationClosed(undefined)).toBe(false);
  });

  it("accepts the ISO string that read paths serialise", () => {
    expect(isRegistrationClosed("2026-10-01T23:59:59.999Z", new Date("2026-09-30T00:00:00Z"))).toBe(false);
    expect(isRegistrationClosed("2026-10-01T23:59:59.999Z", new Date("2026-10-05T00:00:00Z"))).toBe(true);
  });

  it("never locks anyone out on an unreadable value", () => {
    expect(isRegistrationClosed("garbage")).toBe(false);
  });
});

describe("toDateInputValue", () => {
  it("round-trips a stored deadline back into the date input", () => {
    const parsed = parseRegistrationDeadline("2026-10-01");
    if (!parsed.ok) return;
    expect(toDateInputValue(parsed.value)).toBe("2026-10-01");
  });

  it("is blank when there is no deadline", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("garbage")).toBe("");
  });
});
