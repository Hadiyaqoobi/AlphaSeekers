/**
 * Google sign-in policy.
 *
 * The rule that matters most here is email_verified. Signing in with Google for
 * an address that already has a password account signs you into THAT account —
 * which is what we want, and which is only safe because Google has proven the
 * address belongs to whoever is signing in. If that check ever regresses to a
 * warning, an identity provider able to assert an arbitrary address becomes an
 * account-takeover path. These tests exist to make that regression loud.
 */
import { describe, expect, it } from "vitest";

import { evaluateGoogleProfile } from "@/lib/security/google-signin";

describe("evaluateGoogleProfile", () => {
  it("accepts a normal verified Google profile", () => {
    const result = evaluateGoogleProfile({
      email: "student@gmail.com",
      email_verified: true,
      name: "Zahra",
    });
    expect(result).toEqual({ ok: true, email: "student@gmail.com", name: "Zahra" });
  });

  it("REFUSES an unverified email", () => {
    // The account-takeover guard. Do not soften this.
    const result = evaluateGoogleProfile({
      email: "someone-elses@gmail.com",
      email_verified: false,
      name: "Attacker",
    });
    expect(result).toEqual({ ok: false, reason: "EMAIL_UNVERIFIED" });
  });

  it("REFUSES when email_verified is missing entirely", () => {
    // Absent must not be treated as true.
    expect(evaluateGoogleProfile({ email: "x@gmail.com", name: "X" })).toEqual({
      ok: false,
      reason: "EMAIL_UNVERIFIED",
    });
  });

  it("accepts the string \"true\", which some OIDC providers send", () => {
    const result = evaluateGoogleProfile({
      email: "x@gmail.com",
      email_verified: "true" as unknown as boolean,
      name: "X",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a profile with no email at all", () => {
    expect(evaluateGoogleProfile({ email_verified: true, name: "X" })).toEqual({
      ok: false,
      reason: "NO_EMAIL",
    });
    expect(evaluateGoogleProfile({ email: "   ", email_verified: true }).ok).toBe(false);
    expect(evaluateGoogleProfile(null).ok).toBe(false);
    expect(evaluateGoogleProfile(undefined).ok).toBe(false);
  });

  it("lower-cases and trims the address so linking cannot be bypassed by case", () => {
    // "Student@Gmail.com" must resolve to the same row as "student@gmail.com",
    // or a student gets a second, empty account.
    const result = evaluateGoogleProfile({
      email: "  Student@Gmail.COM  ",
      email_verified: true,
      name: "Zahra",
    });
    expect(result.ok && result.email).toBe("student@gmail.com");
  });

  it("falls back to the local part when Google sends no name", () => {
    // User.name is NOT NULL, so an empty name would fail the insert.
    const result = evaluateGoogleProfile({ email: "zahra.n@gmail.com", email_verified: true });
    expect(result.ok && result.name).toBe("zahra.n");
    const blank = evaluateGoogleProfile({ email: "a@b.com", email_verified: true, name: "   " });
    expect(blank.ok && blank.name).toBe("a");
  });
});
