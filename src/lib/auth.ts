import type { UserRole } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { DEMO_USERS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { verifyPassword } from "@/lib/security/passwords";
import { checkRateLimit } from "@/lib/security/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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
      async authorize(credentials) {
        warnIfInsecureProductionConfig();

        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        // Rate limit login attempts per email (BRD §4.2)
        const rl = checkRateLimit(`login:${parsed.data.email.toLowerCase()}`);
        if (!rl.allowed) {
          return null;
        }

        const user = runtime.allowDemoAuth
          ? DEMO_USERS.find(
            (item) =>
              item.email.toLowerCase() === parsed.data.email.toLowerCase() &&
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
          const email = parsed.data.email.toLowerCase();
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

          if (!verifyPassword(parsed.data.password, dbUser.passwordHash)) {
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
    jwt({ token, user }) {
      if (user?.role) {
        token.role = user.role as UserRole;
      }

      if (user?.id) {
        token.sub = user.id;
      }

      if (typeof user?.approved === "boolean") {
        token.approved = user.approved;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = (token.role as UserRole | undefined) ?? "STUDENT";
        session.user.approved = Boolean(token.approved ?? session.user.role === "ADMIN");
      }

      return session;
    },
  },
};
