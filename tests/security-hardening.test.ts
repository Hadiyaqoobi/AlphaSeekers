/**
 * Pure checks behind the security fixes (no database).
 *
 *  - client IP: the rate-limit key must come from a hop the client cannot write
 *  - check-in codes typed on a Dari keyboard
 *  - push endpoints: only real push services (the server POSTs to them)
 *  - OAuth locale / post image URLs: nothing that turns into an off-site link
 */
import { afterEach, describe, expect, it } from "vitest";

import { clientIpFromHeaders } from "@/lib/security/rate-limit";
import { isAllowedPushEndpoint, isSafeHttpUrl } from "@/lib/security/safe-url";
import { normaliseDigits } from "@/lib/security/sanitize";

function headers(map: Record<string, string>) {
  return (name: string) => map[name] ?? null;
}

describe("clientIpFromHeaders", () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
    delete process.env.CLIENT_IP_HEADER;
  });

  it("uses the RIGHT-most X-Forwarded-For hop, not the client-written left one", () => {
    // The client sent "1.2.3.4"; the proxy appended the real address.
    expect(clientIpFromHeaders(headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });

  it("a rotated fake header does not produce a new key", () => {
    const a = clientIpFromHeaders(headers({ "x-forwarded-for": "9.9.9.1, 203.0.113.9" }));
    const b = clientIpFromHeaders(headers({ "x-forwarded-for": "9.9.9.2, 203.0.113.9" }));
    expect(a).toBe(b);
  });

  it("counts extra trusted proxies from the right", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(
      clientIpFromHeaders(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.1" })),
    ).toBe("203.0.113.9");
  });

  it("honours an explicitly configured edge header", () => {
    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    expect(
      clientIpFromHeaders(
        headers({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }),
      ),
    ).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIpFromHeaders(headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(clientIpFromHeaders(headers({}))).toBe("unknown");
  });
});

describe("normaliseDigits", () => {
  it("maps Persian and Arabic-Indic digits to 0-9", () => {
    // Built from code points so this file contains no Persian text.
    const persian = String.fromCharCode(0x06f1, 0x06f2, 0x06f3, 0x06f4);
    const arabic = String.fromCharCode(0x0665, 0x0666, 0x0667, 0x0668);
    expect(normaliseDigits(persian)).toBe("1234");
    expect(normaliseDigits(arabic)).toBe("5678");
    expect(normaliseDigits("90" + String.fromCharCode(0x06f0))).toBe("900");
  });

  it("leaves everything else alone", () => {
    expect(normaliseDigits("12ab")).toBe("12ab");
  });
});

describe("isAllowedPushEndpoint", () => {
  it("accepts the real push services", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
      "https://web.push.apple.com/abc",
      "https://api.push.apple.com/abc",
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(true);
    }
  });

  it("refuses anything the server should not POST to", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc", // not https
      "https://169.254.169.254/latest/meta-data",
      "https://localhost:3005/api/admin",
      "https://fcm.googleapis.com.evil.com/x",
      "https://evilpush.services.mozilla.com.attacker.net/x",
      "https://fcm.googleapis.com:8443/x", // odd port
      "https://user:pass@fcm.googleapis.com/x",
      "not a url",
      42,
    ]) {
      expect(isAllowedPushEndpoint(endpoint), String(endpoint)).toBe(false);
    }
  });
});

describe("post image URLs", () => {
  it("javascript: and data: are refused even though they parse as URLs", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeHttpUrl("https://cdn.example.com/a.png")).toBe(true);
  });
});
