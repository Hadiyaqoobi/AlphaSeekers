import type { UserRole } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { DEMO_USERS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { verifyPassword } from "@/lib/security/passwords";
import { checkRateLimitDistributed } from "@/lib/security/rate-limit";

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
          return null;
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
            },
          });

          if (!dbUser || !dbUser.passwordHash) {
            return null;
          }

          if (!(await verifyPassword(parsed.data.password, dbUser.passwordHash))) {
            return null;
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
          if (error instanceof Error && error.message === "PENDING_APPROVAL") {
            throw error;
          }

          return null;
        }
      },
    }),
  ],
  callbacks: {
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
            select: { id: true, role: true, approvedAt: true },
          });

          if (!dbUser) {
            // User was deleted → drop all authorization.
            return revokeToken(token);
          }

          token.role = dbUser.role;
          token.approved = dbUser.role === "ADMIN" || dbUser.approvedAt != null;
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
      }

      return session;
    },
  },
};
