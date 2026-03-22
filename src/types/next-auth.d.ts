import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role: UserRole;
      approved?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    approved?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    approved?: boolean;
  }
}
