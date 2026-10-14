/**
 * Teacher requests: people who chose "teacher" at signup but are still STUDENT.
 *
 * Registration auto-approves everyone and always creates a STUDENT, recording
 * the wish in `requestedRole`. The approvals screen and the daily digest only
 * looked at UNAPPROVED users, so these applicants became students with nobody
 * ever seeing the request. This module is the one definition of "open teacher
 * request" shared by the admin user list and the pending-approvals digest.
 *
 * Granting is a normal role change (PATCH { role: "TEACHER" }); after it the
 * user is role=TEACHER and drops out of this set. Declining clears
 * `requestedRole`, so a request an admin has decided against stops showing up
 * in the digest every morning.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** An open teacher request. Deactivated accounts are not waiting on anyone. */
export const TEACHER_REQUEST_WHERE = {
  role: "STUDENT",
  requestedRole: "TEACHER",
  deactivatedAt: null,
} satisfies Prisma.UserWhereInput;

const MAX_PAGE_SIZE = 100;

/**
 * Paged list of open teacher requests, oldest first (the longest wait is the
 * one to act on), in the same shape as listAdminUsers so the screen can render
 * either.
 */
export async function listTeacherRequests(params: { page?: number; limit?: number; search?: string } = {}) {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, params.limit ?? 10));
  const search = (params.search ?? "").trim();

  const where: Prisma.UserWhereInput = {
    ...TEACHER_REQUEST_WHERE,
    ...(search
      ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {}),
  };

  const totalItems = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const page = Math.min(Math.max(1, params.page ?? 1), totalPages);

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      requestedRole: true,
      approvedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    items: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      approvedAt: user.approvedAt ? user.approvedAt.toISOString() : null,
    })),
    pagination: { page, limit, totalItems, totalPages },
  };
}

/**
 * Decline a teacher request: forget what they asked for, leave everything else
 * (they stay a STUDENT). Returns null when the user does not exist.
 */
export async function dismissTeacherRequest(userId: string) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { requestedRole: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        requestedRole: true,
        approvedAt: true,
        createdAt: true,
      },
    });
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      approvedAt: user.approvedAt ? user.approvedAt.toISOString() : null,
    };
  } catch {
    return null;
  }
}
