import { describe, expect, it } from "vitest";

import { messageForCode, readErrorBody } from "@/lib/ui/api-error";
import { digitsOnly, toLatinDigits } from "@/lib/ui/digits";
import { formatKabulLongDate, formatKabulTime, kabulDayPart, kabulHour } from "@/lib/ui/kabul-time";
import { liveAccessReason, shouldPollLive } from "@/lib/ui/live-session";
import { passwordProblem } from "@/lib/ui/password-policy";
import { loginHref, pickReturnPath, safeNextPath } from "@/lib/ui/safe-next";

describe("digit normalisation (check-in code on a Dari keyboard)", () => {
  it("converts Persian digits ۰-۹", () => {
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("converts Arabic-Indic digits ٠-٩", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("keeps everything else untouched", () => {
    expect(toLatinDigits("a1 b۲")).toBe("a1 b2");
  });

  it("digitsOnly keeps the digits a Dari keyboard types instead of deleting them", () => {
    // The old /\D/ filter turned "۱۲۳۴" into "" and Verify never enabled.
    expect(digitsOnly("۱۲۳۴")).toBe("1234");
    expect(digitsOnly("١٢-٣ ٤")).toBe("1234");
    expect(digitsOnly("12ab34", 4)).toBe("1234");
    expect(digitsOnly("۱۲۳۴۵", 4)).toBe("1234");
    expect(digitsOnly("")).toBe("");
  });
});

describe("API error → translated message", () => {
  const map = { CLASS_FULL: "full (translated)", REGISTRATION_CLOSED: "closed (translated)" };

  it("translates a known code", () => {
    expect(messageForCode({ code: "CLASS_FULL", message: "This class is full." }, map, "fallback")).toBe(
      "full (translated)",
    );
  });

  it("never returns the server's English message", () => {
    expect(messageForCode({ code: "SOMETHING_NEW", message: "English text" }, map, "fallback")).toBe("fallback");
    expect(messageForCode({ message: "English text" }, map, "fallback")).toBe("fallback");
    expect(messageForCode(null, map, "fallback")).toBe("fallback");
    expect(messageForCode({ code: 42 }, map, "fallback")).toBe("fallback");
  });

  it("does not treat prototype keys as codes", () => {
    expect(messageForCode({ code: "toString" }, map, "fallback")).toBe("fallback");
  });

  it("reads a JSON body and tolerates an empty / non-JSON one", async () => {
    expect(await readErrorBody(new Response(JSON.stringify({ code: "X" }), { status: 400 }))).toEqual({ code: "X" });
    expect(await readErrorBody(new Response("<html>oops</html>", { status: 502 }))).toBeNull();
    expect(await readErrorBody(new Response(null, { status: 500 }))).toBeNull();
  });
});

describe("login return path (next / callbackUrl)", () => {
  it("accepts same-site locale paths", () => {
    expect(safeNextPath("/fa/classes/abc")).toBe("/fa/classes/abc");
    expect(safeNextPath("/en")).toBe("/en");
    expect(safeNextPath("/fa/learn?x=1#y")).toBe("/fa/learn?x=1#y");
  });

  it("rejects open-redirect shapes", () => {
    for (const bad of [
      "//evil.com/fa",
      "/\\evil.com",
      "https://evil.com/fa/x",
      "javascript:alert(1)",
      "fa/classes",
      "/de/classes",
      "/fabulous",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(bad as string | null | undefined), String(bad)).toBeNull();
    }
  });

  it("prefers next, falls back to callbackUrl", () => {
    const params = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(pickReturnPath(params({ next: "/fa/a", callbackUrl: "/fa/b" }))).toBe("/fa/a");
    expect(pickReturnPath(params({ callbackUrl: "/fa/classes/1/live/2" }))).toBe("/fa/classes/1/live/2");
    expect(pickReturnPath(params({ next: "//evil.com", callbackUrl: "/en/x" }))).toBe("/en/x");
    expect(pickReturnPath(params({}))).toBeNull();
  });

  it("accepts an absolute callbackUrl only for our own origin", () => {
    const params = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    const origin = "https://alphaseekers.example";
    expect(pickReturnPath(params({ callbackUrl: `${origin}/fa/stories/write` }), origin)).toBe("/fa/stories/write");
    expect(pickReturnPath(params({ callbackUrl: "https://evil.com/fa/x" }), origin)).toBeNull();
    expect(pickReturnPath(params({ callbackUrl: `${origin}/fa/x` }))).toBeNull();
  });

  it("builds the login link", () => {
    expect(loginHref("fa", "/fa/classes/abc")).toBe("/fa/login?next=%2Ffa%2Fclasses%2Fabc");
    expect(loginHref("en", "//evil.com")).toBe("/en/login");
    expect(loginHref("en")).toBe("/en/login");
  });
});

describe("password rule mirrors the server", () => {
  it("requires 8+ characters with a letter and a number", () => {
    expect(passwordProblem("abc123")).toBe("tooShort");
    expect(passwordProblem("abcdefgh")).toBe("needsLetterAndNumber");
    expect(passwordProblem("12345678")).toBe("needsLetterAndNumber");
    expect(passwordProblem("abcd1234")).toBeNull();
    expect(passwordProblem(`a1${"x".repeat(71)}`)).toBe("tooLong");
  });
});

describe("Kabul time (server runs in UTC)", () => {
  it("reads the hour in Kabul (UTC+4:30), not the server zone", () => {
    // 08:00 UTC = 12:30 Kabul → afternoon, though UTC says morning.
    const d = new Date("2026-10-14T08:00:00Z");
    expect(kabulHour(d)).toBe(12);
    expect(kabulDayPart(d)).toBe("afternoon");
    expect(kabulDayPart(new Date("2026-10-14T03:00:00Z"))).toBe("morning"); // 07:30
    expect(kabulDayPart(new Date("2026-10-14T14:00:00Z"))).toBe("evening"); // 18:30
    expect(kabulHour(new Date("2026-10-14T20:00:00Z"))).toBe(0); // 00:30 next day
  });

  it("formats deterministically for a given locale", () => {
    const d = new Date("2026-10-14T11:30:00Z"); // 16:00 Kabul
    expect(formatKabulTime(d, "en")).toMatch(/04:00\s?PM/);
    expect(formatKabulTime(d, "en")).toBe(formatKabulTime(d.toISOString(), "en"));
    expect(formatKabulLongDate(d, "en")).toBe("Wednesday, October 14");
  });
});

describe("live session roster polling gate", () => {
  const start = "2026-10-14T10:00:00Z";
  const end = "2026-10-14T11:00:00Z";
  const at = (iso: string) => new Date(iso).getTime();

  it("polls only near the session and only while visible", () => {
    expect(shouldPollLive(at("2026-10-14T09:44:00Z"), start, end, true)).toBe(false);
    expect(shouldPollLive(at("2026-10-14T09:45:00Z"), start, end, true)).toBe(true);
    expect(shouldPollLive(at("2026-10-14T10:30:00Z"), start, end, true)).toBe(true);
    expect(shouldPollLive(at("2026-10-14T11:15:00Z"), start, end, true)).toBe(true);
    expect(shouldPollLive(at("2026-10-14T11:16:00Z"), start, end, true)).toBe(false);
    expect(shouldPollLive(at("2026-10-14T10:30:00Z"), start, end, false)).toBe(false);
    expect(shouldPollLive(at("2026-10-14T10:30:00Z"), "nonsense", end, true)).toBe(false);
  });

  it("maps refused-access messages to translation keys", () => {
    expect(liveAccessReason(410, "Session was cancelled")).toBe("cancelled");
    expect(liveAccessReason(403, "You are not enrolled in this class")).toBe("notEnrolled");
    expect(liveAccessReason(403, "This session hasn't started yet. Come back closer to X.")).toBe("notStarted");
    expect(liveAccessReason(403, "This live session has ended. You can still view…")).toBe("ended");
    expect(liveAccessReason(403, "Something new")).toBe("generic");
    expect(liveAccessReason(403, undefined)).toBe("generic");
  });
});
