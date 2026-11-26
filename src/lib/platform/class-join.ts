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
 * Not calling enrollStudentInClass() because this path also creates or
 * authenticates the account, but it must apply EXACTLY the same seat rules:
 * the same per-class advisory lock (READ COMMITTED alone lets two people take
 * the last seat), the same cap on simultaneous classes, the same refusal of
 * someone a teacher removed, and the same `student.enrolled` event — so the
 * teacher hears about the new student and the student gets the welcome with
 * the WhatsApp link, exactly as when joining from inside the platform.
 */

import { EnrollmentStatus, ClassStatus } from "@prisma/client";

import { emit } from "@/lib/events/bus";
import { assertEnrollmentSlot } from "@/lib/platform/enrollment-limit";
import { prisma } from "@/lib/prisma";
import { openAnswers, sealAnswers } from "@/lib/platform/join-answers";
import { checkAnswers, readJoinQuestions, type JoinAnswers, type JoinQuestion } from "@/lib/platform/join-questions";
import { isRegistrationClosed } from "@/lib/platform/registration-deadline";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import { encryptPhone } from "@/lib/security/phone-crypto";

export { MAX_ACTIVE_ENROLLMENTS } from "@/lib/platform/enrollment-limit";

export type JoinOutcome =
  | { ok: true; userId: string; created: boolean; alreadyEnrolled: boolean }
  | { ok: false; code: JoinFailure; questionId?: string };

export type JoinFailure =
  | "CLASS_NOT_FOUND"
  | "CLASS_CLOSED"
  | "REGISTRATION_CLOSED"
  | "CLASS_FULL"
  | "WRONG_PASSWORD"
  // One answer for every "the password was right but this account cannot join
  // from here" case — deactivated, or a teacher/admin account. Distinct codes
  // used to be returned BEFORE the password check, which told anyone typing an
  // address whether it belonged to staff.
  | "USE_SIGN_IN"
  // A teacher removed this student; only staff can let them back in.
  | "NOT_ALLOWED"
  | "ENROLLMENT_LIMIT"
  // A required sign-up question was left empty, or an answer is not valid
  // (ADR-0009). Comes with the question's id so the form can point at it.
  | "INVALID_ANSWERS";

export type JoinInput = {
  classId: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  language?: "FA" | "EN";
  /** Answers to the class's own sign-up questions, keyed by question id. */
  answers?: unknown;
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
      joinQuestions: true,
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

  // The class's own questions, checked before any account is created or
  // looked up: a missing answer must not leave behind an account with no class.
  // Says nothing about the account, so it is safe to answer before the password.
  const answerCheck = checkAnswers(readJoinQuestions(klass.joinQuestions), input.answers);
  if (!answerCheck.ok) {
    return { ok: false, code: "INVALID_ANSWERS", questionId: answerCheck.questionId };
  }
  const answers = sealAnswers(answerCheck.answers);

  let result: { userId: string; created: boolean; alreadyEnrolled: boolean; enrollmentId: string | null };
  try {
    result = await prisma.$transaction(async (tx) => {
      // The same normalized address may submit two public joins at once.
      // Serialize those requests before looking up or creating the account.
      // Account creation rolls back with a refused enrollment; no later cleanup
      // can accidentally delete an account another request is already using.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(418608, hashtext(${email}))`;
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true, role: true, passwordHash: true, deactivatedAt: true },
      });

      if (existing) {
        // Verify credentials before revealing role, account state or enrollment.
        if (!(await verifyPassword(input.password, existing.passwordHash))) throw new Error("WRONG_PASSWORD");
        if (existing.deactivatedAt || existing.role !== "STUDENT") throw new Error("USE_SIGN_IN");
      }

      const account = existing ?? await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          phone: input.phone ? encryptPhone(input.phone) : null,
          passwordHash: await hashPassword(input.password),
          role: "STUDENT",
          requestedRole: "STUDENT",
          approvedAt: new Date(),
          language: input.language ?? "FA",
          timezone: "Asia/Kabul",
        },
        select: { id: true },
      });
      const userId = account.id;
      const created = !existing;

      // Also serialize seat-taking against the signed-in and staff paths.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`enroll:${klass.id}`}))`;

      const current = await tx.enrollment.findUnique({
        where: { studentId_classId: { studentId: userId, classId: klass.id } },
        select: { id: true, status: true },
      });

      if (current?.status === EnrollmentStatus.ACTIVE) {
        return { userId, created, alreadyEnrolled: true, enrollmentId: null };
      }

      // A teacher took this student out of the class. Clicking a link again
      // must not undo a person's decision; staff can re-admit them.
      if (current?.status === EnrollmentStatus.REJECTED) {
        throw new Error("NOT_ALLOWED");
      }

      const liveClass = await tx.class.findUnique({
        where: { id: klass.id },
        select: { status: true, published: true, maxStudents: true, registrationDeadline: true },
      });
      if (!liveClass || liveClass.status !== ClassStatus.ACTIVE || !liveClass.published) {
        throw new Error("CLASS_CLOSED");
      }
      if (isRegistrationClosed(liveClass.registrationDeadline)) throw new Error("REGISTRATION_CLOSED");
      await assertEnrollmentSlot(tx, userId, klass.id);

      const activeCount = await tx.enrollment.count({
        where: { classId: klass.id, status: EnrollmentStatus.ACTIVE },
      });
      if (activeCount >= liveClass.maxStudents) {
        throw new Error("CLASS_FULL");
      }

      const enrollment = current
        ? await tx.enrollment.update({
          where: { studentId_classId: { studentId: userId, classId: klass.id } },
          data: { status: EnrollmentStatus.ACTIVE, enrolledAt: new Date(), ...(answers ? { answers } : {}) },
          select: { id: true },
        })
        : await tx.enrollment.create({
          data: { studentId: userId, classId: klass.id, status: EnrollmentStatus.ACTIVE, ...(answers ? { answers } : {}) },
          select: { id: true },
        });

      return { userId, created, alreadyEnrolled: false, enrollmentId: enrollment.id };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "CLASS_FULL" ||
        error.message === "CLASS_CLOSED" ||
        error.message === "REGISTRATION_CLOSED" ||
        error.message === "NOT_ALLOWED" ||
        error.message === "WRONG_PASSWORD" ||
        error.message === "USE_SIGN_IN" ||
        error.message === "ENROLLMENT_LIMIT")
    ) {
      return { ok: false, code: error.message };
    }
    throw error;
  }

  // Committed. Fan out the same welcome/teacher notices the in-app enroll
  // route sends (same event, same dedupe key). Failing to notify must never
  // fail the join: she IS in the class, and telling her otherwise would make
  // her try again.
  if (result.enrollmentId) {
    try {
      await emit(
        "student.enrolled",
        { classId: klass.id, studentId: result.userId },
        { dedupeKey: `student.enrolled:${result.enrollmentId}` },
      );
    } catch (error) {
      console.error("[class-join] failed to emit student.enrolled", klass.id, error);
    }
  }

  return { ok: true, userId: result.userId, created: result.created, alreadyEnrolled: result.alreadyEnrolled };
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
  /**
   * ISO cutoff, or null when open indefinitely. Carried (not a "closed" flag)
   * because this summary is cached for hours: the page compares it to the
   * clock on every render, so a deadline passing mid-cache still closes the form.
   */
  registrationDeadline: string | null;
  /** The class's own sign-up questions (ADR-0009). Questions only, never answers. */
  questions: JoinQuestion[];
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
      registrationDeadline: true,
      joinQuestions: true,
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
    registrationDeadline: klass.registrationDeadline?.toISOString() ?? null,
    questions: readJoinQuestions(klass.joinQuestions),
  };
}

/**
 * What this student answered last time they were in this class, if anything:
 * someone who left and comes back sees their answers filled in instead of a blank
 * form (and does not lose an answer by leaving it empty the second time).
 */
export async function getPreviousAnswers(studentId: string, classId: string): Promise<JoinAnswers> {
  const row = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId } },
    select: { answers: true },
  });
  return openAnswers(row?.answers);
}
