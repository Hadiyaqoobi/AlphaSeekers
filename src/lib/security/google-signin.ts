/**
 * "Sign in with Google" policy.
 *
 * Why this exists: students could only ever sign in with an email + password
 * they set themselves. Email is never verified anywhere in this codebase, yet
 * password reset is the only recovery path and it goes out over Gmail SMTP — so
 * a student who mistyped their address, or who cannot reach that inbox, was
 * locked out permanently. Google sign-in removes the password, the reset email
 * and the SMTP dependency from the student's path entirely.
 *
 * The decision rules live here, separate from NextAuth, so they can be tested
 * without standing up an auth flow.
 *
 * ── Account linking, and why it is safe ─────────────────────────────────────
 * Signing in with Google for an address that already has a password account
 * signs you into THAT account. That is deliberate — the alternative is a
 * duplicate account and a student who cannot find their classes.
 *
 * It is only safe because we require `email_verified` from Google. Without that
 * check, anyone able to assert an arbitrary address at an identity provider
 * could take over an existing account by signing in "as" it. So the unverified
 * case is refused outright rather than downgraded to a warning.
 *
 * ── What Google sign-in must never do ───────────────────────────────────────
 * Grant privilege. It resolves an existing account or creates a STUDENT. It
 * never sets or raises a role, never revives a deactivated account, and never
 * writes a password hash.
 */

export type GoogleProfileLike = {
  email?: string | null;
  email_verified?: boolean | null;
  name?: string | null;
};

export type GoogleSignInDecision =
  | { ok: true; email: string; name: string }
  | { ok: false; reason: GoogleDenyReason };

/** Deny reasons, surfaced to the login page so the student is told what to do. */
export type GoogleDenyReason =
  | "NO_EMAIL"
  | "EMAIL_UNVERIFIED"
  | "ACCOUNT_DEACTIVATED";

/**
 * Can we accept this Google profile at all? Pure — no database, no network.
 *
 * Runs before any lookup, so an unusable profile never touches the user table.
 */
export function evaluateGoogleProfile(profile: GoogleProfileLike | null | undefined): GoogleSignInDecision {
  const rawEmail = profile?.email?.trim().toLowerCase();

  if (!rawEmail) {
    return { ok: false, reason: "NO_EMAIL" };
  }

  // Google sends this as a boolean, but some OIDC providers send the string
  // "true"; treat anything that is not an explicit affirmative as unverified.
  const verified = profile?.email_verified;
  const isVerified = verified === true || (verified as unknown) === "true";
  if (!isVerified) {
    return { ok: false, reason: "EMAIL_UNVERIFIED" };
  }

  // Google may omit the display name. Fall back to the local part rather than
  // storing an empty string, because `name` is NOT NULL on User.
  const name = profile?.name?.trim() || rawEmail.split("@")[0];

  return { ok: true, email: rawEmail, name };
}

/**
 * The shape the auth layer needs back from a resolved account. Kept minimal so
 * nothing extra leaks into the JWT.
 */
export type ResolvedAccount = {
  id: string;
  email: string;
  name: string;
  role: string;
  approved: boolean;
};

/** Login-page query param used to explain a refusal. */
export const GOOGLE_ERROR_PARAM = "googleError";
