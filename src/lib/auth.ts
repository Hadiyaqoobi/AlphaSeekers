import type { UserRole } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";

import { DEMO_USERS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { evaluateGoogleProfile, GOOGLE_ERROR_PARAM } from "@/lib/security/google-signin";
import { verifyPassword } from "@/lib/security/passwords";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";

/**
 * Errors from authorize() that are MEANT to reach the user, rather than being
 * flattened into "wrong email or password". Each is safe to disclose:
 *  - TOO_MANY_ATTEMPTS  describes the request, not the account
 *  - ACCOUNT_DEACTIVATED / PENDING_APPROVAL  are only reachable AFTER the
 *    password has been verified, so they reveal nothing to someone guessing.
 */
const AUTH_SIGNAL_ERRORS = new Set([
  "TOO_MANY_ATTEMPTS",
  "ACCOUNT_DEACTIVATED",
  "PENDING_APPROVAL",
]);

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Re-check the user's DB status (role/approval/existence) at most this often.
// Between checks the JWT is trusted; a deactivated/demoted/deleted user loses
// access within this window instead of riding a 7-day token to expiry.
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;

function isDemoUserId(id: string | undefined | null): boolean {
  return Boolean(id) && DEMO_USERS.some((item) => item.id === id);
}

/** Strip all authorization claims from a token (deleted/revoked user). */
function revokeToken(token: JWT): JWT {
  delete token.sub;
  delete token.role;
  token.approved = false;
  (token as Record<string, unknown>).revoked = true;
  return token;
}

/** Best-effort client IP from the NextAuth credentials request headers. */
function ipFromAuthRequest(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | string[] | undefined> } | undefined)
    ?.headers;
  if (!headers) return "unknown";

  const rawForwarded = headers["x-forwarded-for"];
  const forwarded = Array.isArray(rawForwarded) ? rawForwarded[0] : rawForwarded;
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  const rawReal = headers["x-real-ip"];
  const real = Array.isArray(rawReal) ? rawReal[0] : rawReal;
  return real?.trim() || "unknown";
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // 7-day session, refreshed on every request the user makes.
    // Was 30 minutes, which silently bounced active admins to /login mid-session
    // (UAT 2026-04-26 CRIT-A). NextAuth rotates the JWT on `updateAge` cadence.
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/fa/login",
    error: "/fa/login",
  },
  providers: [
    // Google is listed FIRST so it renders as the primary option. It is only
    // registered when credentials are present, so local/demo environments
    // without a Google client still boot and still show the password form.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          // Always show the chooser. Shared phones and shared computers are
          // common here, and silent reuse of whichever account Google happens
          // to remember is how one student ends up inside another's account.
          authorization: { params: { prompt: "select_account" } },
        }),
      ]
      : []),
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        warnIfInsecureProductionConfig();

        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();

        // Rate limit login attempts per IP + email (BRD §4.2). Keying by email
        // alone lets an attacker exhaust a victim's budget (lockout DoS) and
        // ignores distributed brute force from one IP across many emails.
        const ip = ipFromAuthRequest(req);
        const rl = await checkRateLimitDistributed(`login:${ip}:${email}`);
        if (!rl.allowed) {
          // Was `return null`, which NextAuth renders as the SAME message a
          // wrong password gets. Five mistyped attempts therefore looked
          // identical to "your password is wrong", and a student who tried
          // again carefully still failed — so they concluded the account was
          // broken. Say what actually happened instead.
          //
          // This leaks nothing: the limiter is keyed on ip+email and answers
          // "you have tried too often", which is true whether or not that
          // account exists, so it is not a user-enumeration oracle.
          throw new Error("TOO_MANY_ATTEMPTS");
        }

        // Demo auth is impossible in production regardless of any stray toggle:
        // it requires BOTH allowDemoAuth AND non-production mode.
        const demoAuthAllowed = runtime.allowDemoAuth && runtime.mode !== "production";
        const user = demoAuthAllowed
          ? DEMO_USERS.find(
            (item) =>
              item.email.toLowerCase() === email &&
              item.password === parsed.data.password,
          )
          : null;

        if (user) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            approved: true,
          };
        }

        try {
          const dbUser = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              passwordHash: true,
              approvedAt: true,
              deactivatedAt: true,
            },
          });

          if (!dbUser || !dbUser.passwordHash) {
            return null;
          }

          if (!(await verifyPassword(parsed.data.password, dbUser.passwordHash))) {
            return null;
          }

          // A deactivated employee cannot authenticate at all — deny even with
          // valid credentials, before any token is issued. Enforcing this at the
          // auth layer (not just the API guards) stops a deactivated account from
          // logging in and riding a fresh 7-day JWT. Checked after password
          // verification so timing matches a normal login (no user enumeration).
          if (dbUser.deactivatedAt) {
            // Told plainly rather than as a generic failure. Safe to reveal
            // here specifically because it is checked AFTER the password
            // verified: an attacker who cannot supply the password never
            // reaches this branch, so it is not an enumeration oracle either.
            throw new Error("ACCOUNT_DEACTIVATED");
          }

          if (dbUser.role !== "ADMIN" && !dbUser.approvedAt) {
            throw new Error("PENDING_APPROVAL");
          }

          return {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            approved: true,
          };
        } catch (error) {
          // These are deliberate signals, not faults: re-throw so NextAuth
          // carries the reason to the login page. Anything else is a genuine
          // error and collapses to a generic failure, which is what keeps a
          // real fault from telling an attacker whether an account exists.
          if (error instanceof Error && AUTH_SIGNAL_ERRORS.has(error.message)) {
            throw error;
          }

          return null;
        }
      },
    }),
  ],
  callbacks: {
    /**
     * Google sign-in: resolve the account, or create a STUDENT.
     *
     * Runs before `jwt`. On success it writes the DATABASE id (and role) onto
     * `user`, which `jwt` below already knows how to seed claims from — without
     * that, `user.id` would be Google's subject and every Google session would
     * carry a subject that matches no row in our user table.
     *
     * Returning a string redirects to it; that is how a refusal reaches the
     * login page as something a student can act on instead of NextAuth's
     * generic "AccessDenied".
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return true; // credentials path already decided in authorize()
      }

      const decision = evaluateGoogleProfile(profile);
      if (!decision.ok) {
        return `/fa/login?${GOOGLE_ERROR_PARAM}=${decision.reason}`;
      }

      try {
        const existing = await prisma.user.findUnique({
          where: { email: decision.email },
          select: {
            id: true,
            name: true,
            role: true,
            approvedAt: true,
            deactivatedAt: true,
          },
        });

        if (existing) {
          // A deactivated account must not be revivable by arriving through a
          // different door. Same rule the credentials path enforces.
          if (existing.deactivatedAt) {
            return `/fa/login?${GOOGLE_ERROR_PARAM}=ACCOUNT_DEACTIVATED`;
          }

          // Link, do not duplicate: this is the existing account, whatever way
          // it was originally created. Role is READ, never written — Google
          // sign-in can never grant or raise privilege.
          user.id = existing.id;
          user.name = existing.name;
          (user as { role?: string }).role = existing.role;
          (user as { approved?: boolean }).approved =
            existing.role === "ADMIN" || existing.approvedAt != null;
          return true;
        }

        // First time through: create the student. No passwordHash is written,
        // so this account simply has no password to forget — the whole point.
        const created = await prisma.user.create({
          data: {
            name: decision.name,
            email: decision.email,
            role: "STUDENT",
            requestedRole: "STUDENT",
            // Signing up has not waited on an admin since the register route
            // stopped gating it; course access is the real gate. Matching that
            // here keeps the two entry paths consistent.
            approvedAt: new Date(),
            language: "FA",
            timezone: "Asia/Kabul",
          },
          select: { id: true, name: true, role: true },
        });

        user.id = created.id;
        user.name = created.name;
        (user as { role?: string }).role = created.role;
        (user as { approved?: boolean }).approved = true;
        return true;
      } catch (error) {
        console.error("[auth] google sign-in failed:", error);
        return `/fa/login?${GOOGLE_ERROR_PARAM}=SIGNIN_FAILED`;
      }
    },

    async jwt({ token, user }) {
      // Initial sign-in: seed claims from the authorize() result.
      if (user) {
        if (user.role) {
          token.role = user.role as UserRole;
        }
        if (user.id) {
          token.sub = user.id;
        }
        if (typeof user.approved === "boolean") {
          token.approved = user.approved;
        }
        token.lastValidatedAt = Date.now();
        return token;
      }

      // Demo users never exist in the DB — don't revalidate (dev only).
      if (isDemoUserId(token.sub)) {
        return token;
      }

      // Periodically re-check the DB so role/approval/existence changes take
      // effect within REVALIDATE_INTERVAL_MS instead of persisting for the full
      // 7-day JWT lifetime. This is the session-revocation path (SEC HIGH).
      const lastValidatedAt =
        typeof token.lastValidatedAt === "number" ? token.lastValidatedAt : 0;

      if (token.sub && Date.now() - lastValidatedAt >= REVALIDATE_INTERVAL_MS) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: {
              id: true,
              role: true,
              approvedAt: true,
              deactivatedAt: true,
              mustChangePassword: true,
            },
          });

          if (!dbUser || dbUser.deactivatedAt) {
            // User was deleted OR deactivated → drop all authorization via the
            // same revocation path. A deactivation now takes effect within
            // REVALIDATE_INTERVAL_MS instead of persisting for the JWT lifetime.
            return revokeToken(token);
          }

          token.role = dbUser.role;
          token.approved = dbUser.role === "ADMIN" || dbUser.approvedAt != null;
          // Carry the forced-password-reset flag so the session can surface it.
          // The JWT interface extends Record<string, unknown>, so this extra
          // claim is type-safe without touching the (unowned) type augmentation.
          token.mustChangePassword = dbUser.mustChangePassword;
          token.lastValidatedAt = Date.now();
        } catch {
          // Transient DB error: keep the current claims but leave
          // lastValidatedAt unchanged so we retry on the next request.
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // A revoked token has no subject → surface an unauthenticated session
        // (getSessionUser requires session.user.id).
        session.user.id = token.sub;
        session.user.role = (token.role as UserRole | undefined) ?? "STUDENT";
        session.user.approved = Boolean(token.approved ?? session.user.role === "ADMIN");
        // Surface the forced-password-reset flag for UI. Set via a cast (as with
        // other extra claims) since the session.user type augmentation is owned
        // by an unowned .d.ts; authorization itself never trusts this — the
        // guards re-read the live DB row on every privileged request.
        (session.user as Record<string, unknown>).mustChangePassword = Boolean(
          token.mustChangePassword,
        );
      }

      return session;
    },
  },
};
