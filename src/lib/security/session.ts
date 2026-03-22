import type { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: UserRole;
  approved: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.role) {
    return null;
  }

  const approved = Boolean(session.user.approved ?? session.user.role === "ADMIN");

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    approved,
  };
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ message }, { status: 403 });
}

export function pendingApproval(message = "Pending approval") {
  return NextResponse.json({ message, code: "PENDING_APPROVAL" }, { status: 403 });
}

export function badRequest(message = "Bad request") {
  return NextResponse.json({ message }, { status: 400 });
}

export function roleAllowed(role: UserRole, allowed: UserRole[]) {
  return allowed.includes(role);
}

export function isApproved(user: SessionUser) {
  return user.role === "ADMIN" || user.approved;
}
