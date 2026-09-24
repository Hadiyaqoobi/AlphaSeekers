/**
 * Joining a class from its public page, in ONE step.
 *
 * The old path asked a student to do six separate things: find the class, make
 * a platform account, confirm it, sign in, find the class again, then request
 * to join and wait for an admin. Each step lost people. Worse, a class with a
 * `registrationFormUrl` sent them to Google and never brought them back, so
 * they filled in a form and still had no account, no class and no meeting link.
 *
 * This collapses all of it: name, email, password, submit. That single submit
 * creates the account AND puts them in the class, and the caller signs them in
 * straight afterwards. The password they choose here is their platform
 * password — there is no second sign-up moment anywhere.
 *
 * Deliberately NOT reusing enrollStudentInClass(): that creates a PENDING
 * request for an admin to approve, which is the bottleneck this replaces.
 * Joining here is immediate (ACTIVE) and a teacher can remove someone after.
 */

import { EnrollmentStatus, ClassStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isRegistrationClosed } from "@/lib/platform/registration-deadline";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import { encryptPhone } from "@/lib/security/phone-crypto";

export type JoinOutcome =
  | { ok: true; userId: string; created: boolean; alreadyEnrolled: boolean }
  | { ok: false; code: JoinFailure };

export type JoinFailure =
  | "CLASS_NOT_FOUND"
  | "CLASS_CLOSED"
  | "REGISTRATION_CLOSED"
  | "CLASS_FULL"
  | "WRONG_PASSWORD"
  | "ACCOUNT_DEACTIVATED"
  | "NOT_A_STUDENT";

export type JoinInput = {
  classId: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  language?: "FA" | "EN";
};

/**
 * Create-or-authenticate, then enrol — atomically enough that a student never
 * ends up with an account but no class.
 *
 * Returning users: the email already exists, so the password they typed is
 * checked against the account. A WRONG password must NOT enrol anyone and must
 * NOT reveal anything beyond "that did not match" — otherwise this endpoint
 * becomes a way to enrol into classes as somebody else. Callers must rate-limit
 * it for the same reason: it can be used to test passwords.
 */
export async function joinClassWithNewAccount(input: JoinInput): Promise<JoinOutcome> {
  const email = input.email.trim().toLowerCase();

  const klass = await prisma.class.findUnique({
    where: { id: input.classId },
    select: {
      id: true,
      status: true,
      published: true,
      maxStudents: true,
      registrationDeadline: true,
    },
  });

  if (!klass) return { ok: false, code: "CLASS_NOT_FOUND" };

  // An unpublished or archived class is not open to the public, and its join
  // link must not work just because someone kept the URL.
  if (klass.status !== ClassStatus.ACTIVE || !klass.published) {
    return { ok: false, code: "CLASS_CLOSED" };
  }

  // The registration cutoff applies here exactly as it does to the in-platform
  // join button: the public form must not be a way around a closed class.
  if (isRegistrationClosed(klass.registrationDeadline)) {
    return { ok: false, code: "REGISTRATION_CLOSED" };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      deactivatedAt: true,
    },
  });

  let userId: string;
  let created = false;

  if (existing) {
    if (existing.deactivatedAt) return { ok: false, code: "ACCOUNT_DEACTIVATED" };

    // A teacher or admin typing their own address into a student join form is
    // almost certainly a mistake; enrolling them as a student would scramble
    // their dashboard. Send them to sign in instead.
    if (existing.role !== "STUDENT") return { ok: false, code: "NOT_A_STUDENT" };

    // Google-only accounts have no password to check against. Treat as a
    // mismatch — they should use the Google button, not invent a password here.
    if (!existing.passwordHash) return { ok: false, code: "WRONG_PASSWORD" };

    if (!(await verifyPassword(input.password, existing.passwordHash))) {
      return { ok: false, code: "WRONG_PASSWORD" };
    }

    userId = existing.id;
  } else {
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        phone: input.phone ? encryptPhone(input.phone) : null,
        passwordHash: await hashPassword(input.password),
        role: "STUDENT",
        requestedRole: "STUDENT",
        // Account approval is not the gate any more (see api/auth/register);
        // being in a class is. Matching that here keeps the entry paths aligned.
        approvedAt: new Date(),
        language: input.language ?? "FA",
        timezone: "Asia/Kabul",
      },
      select: { id: true },
    });
    userId = user.id;
    created = true;
  }

  // Capacity is re-read inside the transaction so two students submitting at
  // the same moment cannot both take the last seat.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.enrollment.findUnique({
        where: { studentId_classId: { studentId: userId, classId: klass.id } },
        select: { id: true, status: true },
      });

      if (current?.status === EnrollmentStatus.ACTIVE) {
        return { alreadyEnrolled: true };
      }

      const activeCount = await tx.enrollment.count({
        where: { classId: klass.id, status: EnrollmentStatus.ACTIVE },
      });
      if (activeCount >= klass.maxStudents) {
        throw new Error("CLASS_FULL");
      }

      if (current) {
        await tx.enrollment.update({
          where: { studentId_classId: { studentId: userId, classId: klass.id } },
          data: { status: EnrollmentStatus.ACTIVE, enrolledAt: new Date() },
        });
      } else {
        await tx.enrollment.create({
          data: { studentId: userId, classId: klass.id, status: EnrollmentStatus.ACTIVE },
        });
      }

      return { alreadyEnrolled: false };
    });

    return { ok: true, userId, created, alreadyEnrolled: result.alreadyEnrolled };
  } catch (error) {
    if (error instanceof Error && error.message === "CLASS_FULL") {
      return { ok: false, code: "CLASS_FULL" };
    }
    throw error;
  }
}

/** What the public join page may show. Nothing private: no meeting link, no
 *  roster, no materials — those appear only once the student is in the class. */
export type PublicClassSummary = {
  id: string;
  name: string;
  subjectCategory: string;
  description: string;
  language: string;
  schedulePreference: string;
  durationMinutes: number;
  teacherName: string | null;
  seatsLeft: number;
  isFull: boolean;
};

/**
 * Fetch a class for its PUBLIC join page. Returns null for anything the public
 * has no business seeing — unpublished, archived, or simply absent — so an old
 * or guessed link reveals nothing about whether that class exists.
 */
export async function getPublicClassForJoin(classId: string): Promise<PublicClassSummary | null> {
  const klass = await prisma.class.findFirst({
    where: { id: classId, status: ClassStatus.ACTIVE, published: true },
    select: {
      id: true,
      name: true,
      subjectCategory: true,
      description: true,
      language: true,
      schedulePreference: true,
      durationMinutes: true,
      maxStudents: true,
      teacher: { select: { name: true } },
      _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } } },
    },
  });

  if (!klass) return null;

  const seatsLeft = Math.max(0, klass.maxStudents - klass._count.enrollments);

  return {
    id: klass.id,
    name: klass.name,
    subjectCategory: klass.subjectCategory,
    description: klass.description,
    language: klass.language,
    schedulePreference: klass.schedulePreference ?? "TBD",
    durationMinutes: klass.durationMinutes,
    teacherName: klass.teacher?.name ?? null,
    seatsLeft,
    isFull: seatsLeft === 0,
  };
}
