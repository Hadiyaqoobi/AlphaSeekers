/**
 * Class materials and library resources are rendered straight into hrefs, so an
 * unvalidated URL is stored XSS: a `javascript:` link a student clicks runs in
 * their session. These tests pin the allowlist.
 */
import { describe, expect, it } from "vitest";

import { MAX_URL_LENGTH, isSafeHttpUrl, normaliseHttpUrl } from "@/lib/security/safe-url";

describe("isSafeHttpUrl", () => {
  it("accepts ordinary http and https links", () => {
    expect(isSafeHttpUrl("https://drive.google.com/file/d/abc/view")).toBe(true);
    expect(isSafeHttpUrl("http://example.org/notes.pdf")).toBe(true);
    expect(isSafeHttpUrl("https://example.org/a%20b.pdf?x=1#p2")).toBe(true);
  });

  it("rejects every scheme that can execute or embed", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://example.org/uuid",
    ]) {
      expect(isSafeHttpUrl(bad), bad).toBe(false);
    }
  });

  it("rejects values that are not usable URLs at all", () => {
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl("   ")).toBe(false);
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl("/relative/path.pdf")).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl(undefined)).toBe(false);
    expect(isSafeHttpUrl(12345)).toBe(false);
    expect(isSafeHttpUrl(`https://example.org/${"a".repeat(MAX_URL_LENGTH)}`)).toBe(false);
  });

  it("normalises to a trimmed string or null", () => {
    expect(normaliseHttpUrl("  https://example.org/x.pdf  ")).toBe("https://example.org/x.pdf");
    expect(normaliseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(normaliseHttpUrl(undefined)).toBeNull();
  });
});
