/**
 * Verifiable certificates: staff issue them from a class page, or from the
 * Certificates page for a course that was never set up as a class here (the
 * class and teacher are then typed in). Anyone checks one by scanning its QR
 * code (/verify/<code>).
 *
 * Built for the free Neon plan:
 *   - Nothing runs on a timer. The database is touched only when staff issue or
 *     cancel, when a signed-in person opens their dashboard, or when a QR code is
 *     scanned, and a scan is served from the public read cache after the first
 *     one (src/lib/platform/public-cache.ts), so a certificate passed around a
 *     WhatsApp group does not keep waking the database.
 *   - No files are stored. A row is a few hundred bytes; the certificate itself
 *     is drawn from it on demand over the static template image.
 */
import { randomInt } from "node:crypto";

import { Prisma, type CertificateKind } from "@prisma/client";

import type { CertificateContent } from "@/lib/certificates/layout";
import { deliverWithFallback, sendDirectEmail } from "@/lib/integrations/notifications";
import { prisma } from "@/lib/prisma";
import { readThroughPublicCache } from "@/lib/platform/public-cache";

// Crockford base32: no I, L, O or U, so a code read aloud or typed from paper
// cannot be confused (0/O, 1/I/L).
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** "AS-2026-K7QM-3XPD": 40 random bits, far too many to guess a real one. */
export function generateCertificateCode(now: Date = new Date()): string {
  const pick = () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join("");
  return `AS-${now.getUTCFullYear()}-${block()}-${block()}`;
}

/** Accepts a code typed by hand: any case, spaces, the look-alike letters. */
export function normalizeCertificateCode(raw: string): string {
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // Not URL-encoded after all; use it as typed.
  }
  const code = text.trim().toUpperCase().replace(/\s+/g, "");
  const prefix = /^AS-\d{4}-/.exec(code)?.[0];
  if (!prefix) return code;
  // Only the random part: Crockford reads O as 0 and I/L as 1.
  return prefix + code.slice(prefix.length).replace(/O/g, "0").replace(/[IL]/g, "1");
}

export function certificateVerifyUrl(code: string): string {
  const base = (process.env.APP_BASE_URL ?? "https://alphaseekers.org").replace(/\/$/, "");
  return `${base}/en/verify/${code}`;
}

function activeKey(classId: string, userId: string, kind: CertificateKind) {
  return `${classId}:${userId}:${kind}`;
}

export type VerifiedCertificate = CertificateContent & {
  revokedAt: string | null;
  /** Certificates made by hand before this feature: a fixed PDF instead of a drawn page. */
  legacyPdf?: string;
  legacyRole?: string;
  legacyStart?: string;
};

/**
 * Certificates issued by hand before the platform could issue them. Their QR
 * codes are already printed, so they must keep verifying.
 */
const LEGACY: Record<string, VerifiedCertificate> = {
  "AS-TEACH-2026-HN-8F4C": {
    kind: "TEACHER_RECOGNITION",
    code: "AS-TEACH-2026-HN-8F4C",
    recipientName: "Hadia Noori",
    className: "Pre-intermediate English",
    teacherName: "Hadia Noori",
    detail: null,
    hours: null,
    issuedAt: "2026-09-30T12:00:00.000Z",
    revokedAt: null,
    legacyPdf: "/certificates/Hadia-Noori-AlphaSeekers-Teaching-Certificate.pdf",
    legacyRole: "Volunteer teacher",
    legacyStart: "20 August 2026",
  },
};

type CertificateRow = {
  code: string;
  kind: CertificateKind;
  recipientName: string;
  className: string;
  teacherName: string;
  detail: string | null;
  hours: string | null;
  issuedAt: Date;
  revokedAt: Date | null;
};

const ROW_SELECT = {
  code: true,
  kind: true,
  recipientName: true,
  className: true,
  teacherName: true,
  detail: true,
  hours: true,
  issuedAt: true,
  revokedAt: true,
} as const;

function toVerified(row: CertificateRow): VerifiedCertificate {
  return {
    kind: row.kind,
    code: row.code,
    recipientName: row.recipientName,
    className: row.className,
    teacherName: row.teacherName,
    detail: row.detail,
    hours: row.hours,
    issuedAt: row.issuedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

/**
 * Look a certificate up for the public verify page. Cached: a cancel is a write
 * to Certificate, which invalidates the cache at once (src/lib/prisma.ts), so a
 * cancelled certificate never keeps showing as valid.
 */
export async function findCertificateForVerify(rawCode: string): Promise<VerifiedCertificate | null> {
  const code = normalizeCertificateCode(rawCode);
  if (LEGACY[code]) return LEGACY[code];
  // Cheap rejection before any database work: a real code always looks like this.
  if (!/^AS-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code)) return null;

  return readThroughPublicCache(
    "certificates",
    code,
    async () => {
      const row = await prisma.certificate.findUnique({ where: { code }, select: ROW_SELECT });
      return row ? toVerified(row) : null;
    },
    // Unknown codes are not kept: anyone can type them, and they would push
    // real pages out of the cache.
    { shouldCache: (value) => value !== null },
  );
}

export type ClassCertificateRow = VerifiedCertificate & {
  userId: string | null;
  revokedReason: string | null;
};

export async function listClassCertificates(classId: string): Promise<ClassCertificateRow[]> {
  const rows = await prisma.certificate.findMany({
    where: { classId },
    select: { ...ROW_SELECT, userId: true, revokedReason: true },
    orderBy: { issuedAt: "desc" },
  });
  return rows.map((row) => ({ ...toVerified(row), userId: row.userId, revokedReason: row.revokedReason }));
}

/** Every certificate issued, newest first (admin Certificates page). */
export async function listAllCertificates(take = 300): Promise<ClassCertificateRow[]> {
  const rows = await prisma.certificate.findMany({
    select: { ...ROW_SELECT, userId: true, revokedReason: true },
    orderBy: { issuedAt: "desc" },
    take,
  });
  return rows.map((row) => ({ ...toVerified(row), userId: row.userId, revokedReason: row.revokedReason }));
}

/** A person's own valid certificates, newest first (dashboard). */
export async function listUserCertificates(userId: string): Promise<VerifiedCertificate[]> {
  const rows = await prisma.certificate.findMany({
    where: { userId, revokedAt: null },
    select: ROW_SELECT,
    orderBy: { issuedAt: "desc" },
    take: 50,
  });
  return rows.map(toVerified);
}

/**
 * What staff will most likely want printed, from the sessions the class has
 * actually held. Only a suggestion: staff can change every field before issuing.
 */
export async function suggestCertificateDetails(classId: string, now: Date = new Date()) {
  const sessions = await prisma.session.findMany({
    where: { classId, cancelled: false, startTime: { lte: now } },
    select: { startTime: true, endTime: true },
    orderBy: { startTime: "asc" },
  });
  if (sessions.length === 0) return { length: "", term: "", hours: "" };

  const first = sessions[0].startTime;
  const last = sessions[sessions.length - 1].startTime;
  const weeks = Math.max(1, Math.round((last.getTime() - first.getTime()) / (7 * 24 * 3600 * 1000)) + 1);
  const minutes = sessions.reduce(
    (sum, s) => sum + Math.max(0, Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000)),
    0,
  );
  const hours = Math.round((minutes / 60) * 2) / 2;
  const month = (d: Date) => d.toLocaleString("en-US", { month: "long", timeZone: "Asia/Kabul" });
  const year = (d: Date) => d.toLocaleString("en-US", { year: "numeric", timeZone: "Asia/Kabul" });
  const term =
    month(first) === month(last) && year(first) === year(last)
      ? `${month(first)} ${year(first)}`
      : year(first) === year(last)
        ? `${month(first)} – ${month(last)} ${year(last)}`
        : `${month(first)} ${year(first)} – ${month(last)} ${year(last)}`;

  return {
    length: `${weeks}-week`,
    term,
    hours: hours > 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "",
  };
}

export type IssueInput = {
  classId: string;
  issuedById: string;
  studentIds: string[];
  includeTeacher: boolean;
  /** Student certificates: the course length, e.g. "8-week". */
  length?: string | null;
  /** Teacher certificate: the term, e.g. "Fall 2026". */
  term?: string | null;
  /** Teacher certificate: total hours, e.g. "24 hours". */
  hours?: string | null;
};

export type IssuedCertificate = {
  code: string;
  /** Null for someone typed in by hand who has no account. */
  userId: string | null;
  /** Where to send the link when there is no account. */
  email: string | null;
  kind: CertificateKind;
  recipientName: string;
};

export type IssueResult =
  | { ok: true; issued: IssuedCertificate[]; alreadyHad: number }
  | {
      ok: false;
      reason:
        | "class-not-found"
        | "nobody-selected"
        | "not-in-class"
        | "name-missing"
        | "bad-email"
        | "class-name-missing"
        | "teacher-name-missing";
    };

const clean = (value: string | null | undefined, max: number) => {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
};

type ClassForIssue = { id: string; name: string; teacherId: string; teacher: { name: string } };

function loadClassForIssue(classId: string): Promise<ClassForIssue | null> {
  return prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, teacherId: true, teacher: { select: { name: true } } },
  });
}

/** What every certificate prints besides the person: the class and its teacher. */
type PrintedCourse = { classId: string | null; className: string; teacherName: string };

const courseOf = (klass: ClassForIssue): PrintedCourse => ({
  classId: klass.id,
  className: klass.name,
  teacherName: klass.teacher.name,
});

type Recipient = { key: string; userId: string | null; email: string | null; name: string; kind: CertificateKind };

/**
 * Create one certificate per recipient, skipping anyone who already holds a
 * valid one. The unique activeKey still catches a double click that slips
 * between the read and the insert.
 */
async function createCertificates(
  course: PrintedCourse,
  recipients: Recipient[],
  wording: { length?: string | null; term?: string | null; hours?: string | null },
  issuedById: string,
): Promise<{ issued: IssuedCertificate[]; alreadyHad: number }> {
  const length = clean(wording.length, 40);
  const term = clean(wording.term, 60);
  const hours = clean(wording.hours, 40);

  const held = new Set(
    (
      await prisma.certificate.findMany({
        where: { activeKey: { in: recipients.map((r) => r.key) } },
        select: { activeKey: true },
      })
    ).map((row) => row.activeKey),
  );

  const issued: IssuedCertificate[] = [];
  let alreadyHad = 0;
  for (const person of recipients) {
    if (held.has(person.key)) {
      alreadyHad += 1;
      continue;
    }
    // Two tries: the second only matters if a freshly generated code collides,
    // which at 40 bits is not expected to ever happen.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const code = generateCertificateCode();
      try {
        await prisma.certificate.create({
          data: {
            code,
            kind: person.kind,
            userId: person.userId,
            classId: course.classId,
            recipientName: person.name.trim(),
            className: course.className.trim(),
            teacherName: course.teacherName.trim(),
            detail: person.kind === "STUDENT_COMPLETION" ? length : term,
            hours: person.kind === "TEACHER_RECOGNITION" ? hours : null,
            issuedById,
            activeKey: person.key,
          },
        });
        issued.push({ code, userId: person.userId, email: person.email, kind: person.kind, recipientName: person.name });
        break;
      } catch (error) {
        const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
          ? String((error.meta as { target?: unknown } | undefined)?.target ?? "")
          : null;
        if (target === null) throw error;
        if (target.includes("activeKey")) {
          alreadyHad += 1;
          break;
        }
        // A code collision: loop and try a fresh code.
      }
    }
  }
  return { issued, alreadyHad };
}

/**
 * Issue certificates for one class. Only the class's own teacher and its
 * enrolled students can receive one; anyone who already holds a valid
 * certificate for this class is skipped, not duplicated.
 */
export async function issueCertificates(input: IssueInput): Promise<IssueResult> {
  const klass = await loadClassForIssue(input.classId);
  if (!klass) return { ok: false, reason: "class-not-found" };

  const studentIds = Array.from(new Set(input.studentIds)).filter((id) => id !== klass.teacherId);
  if (studentIds.length === 0 && !input.includeTeacher) return { ok: false, reason: "nobody-selected" };

  const students = studentIds.length
    ? await prisma.enrollment.findMany({
        where: { classId: klass.id, studentId: { in: studentIds }, status: "ACTIVE" },
        select: { student: { select: { id: true, name: true } } },
      })
    : [];
  if (students.length !== studentIds.length) return { ok: false, reason: "not-in-class" };

  const recipients: Recipient[] = [
    ...students.map((e) => ({
      key: activeKey(klass.id, e.student.id, "STUDENT_COMPLETION"),
      userId: e.student.id,
      email: null,
      name: e.student.name,
      kind: "STUDENT_COMPLETION" as const,
    })),
    ...(input.includeTeacher
      ? [{
          key: activeKey(klass.id, klass.teacherId, "TEACHER_RECOGNITION"),
          userId: klass.teacherId,
          email: null,
          name: klass.teacher.name,
          kind: "TEACHER_RECOGNITION" as const,
        }]
      : []),
  ];

  return { ok: true, ...(await createCertificates(courseOf(klass), recipients, input, input.issuedById)) };
}

export type ManualIssueInput = {
  classId: string;
  issuedById: string;
  /** Exactly as it should be printed. */
  name: string;
  /** Optional. Matched to an account when one exists, so it shows on their dashboard. */
  email?: string | null;
  kind: CertificateKind;
  length?: string | null;
  term?: string | null;
  hours?: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks a typed-in name and email, and finds the account that email belongs to, if any. */
async function resolveTypedPerson(rawName: string, rawEmail: string | null | undefined) {
  const name = clean(rawName, 100);
  if (!name || name.length < 2) return { ok: false as const, reason: "name-missing" as const };
  const email = clean(rawEmail, 254)?.toLowerCase() ?? null;
  if (email && !EMAIL_PATTERN.test(email)) return { ok: false as const, reason: "bad-email" as const };

  const account = email
    ? await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })
    : null;
  return { ok: true as const, name, email, account };
}

/**
 * Issue one certificate to a person staff type in by hand: for when the class
 * list does not show someone (or does not load at all), or for someone who
 * took part without an account. The class still sets the class and teacher
 * printed on it.
 */
export async function issueManualCertificate(input: ManualIssueInput): Promise<IssueResult> {
  const klass = await loadClassForIssue(input.classId);
  if (!klass) return { ok: false, reason: "class-not-found" };

  const person = await resolveTypedPerson(input.name, input.email);
  if (!person.ok) return person;
  const { name, email, account } = person;

  // With an account, the same one-per-person rule as the list (so a typed-in
  // person who also appears in the list is not issued twice). Without one,
  // one per typed name, so a double click cannot issue two.
  const key = account
    ? activeKey(klass.id, account.id, input.kind)
    : `${klass.id}:name:${name.toLowerCase()}:${input.kind}`;

  const result = await createCertificates(
    courseOf(klass),
    [{ key, userId: account?.id ?? null, email, name, kind: input.kind }],
    input,
    input.issuedById,
  );
  return { ok: true, ...result };
}

export type StandaloneIssueInput = {
  issuedById: string;
  /** Exactly as it should be printed. */
  name: string;
  /** Optional. Matched to an account when one exists, so it shows on their dashboard. */
  email?: string | null;
  kind: CertificateKind;
  /** The course, as printed ("English for Beginners"). */
  className: string;
  /** Printed on student certificates ("taught by ..."). A teacher's own certificate defaults to their name. */
  teacherName?: string | null;
  length?: string | null;
  term?: string | null;
  hours?: string | null;
};

/**
 * Issue one certificate for a course that has no class on the platform (it
 * ran on WhatsApp or Meet only, or before the platform). Staff type the class
 * and teacher as they should be printed. One valid certificate per person, per
 * course name, per kind, so a double click cannot issue two.
 */
export async function issueStandaloneCertificate(input: StandaloneIssueInput): Promise<IssueResult> {
  const person = await resolveTypedPerson(input.name, input.email);
  if (!person.ok) return person;
  const { name, email, account } = person;

  const className = clean(input.className, 120);
  if (!className || className.length < 2) return { ok: false, reason: "class-name-missing" };
  const teacherName =
    clean(input.teacherName, 100) ?? (input.kind === "TEACHER_RECOGNITION" ? name : null);
  if (!teacherName || teacherName.length < 2) return { ok: false, reason: "teacher-name-missing" };

  // Never collides with a class key ("<cuid>:..."): those never start with "course:".
  const course = className.toLowerCase();
  const key = account
    ? `course:${course}:${account.id}:${input.kind}`
    : `course:${course}:name:${name.toLowerCase()}:${input.kind}`;

  const result = await createCertificates(
    { classId: null, className, teacherName },
    [{ key, userId: account?.id ?? null, email, name, kind: input.kind }],
    input,
    input.issuedById,
  );
  return { ok: true, ...result };
}

/** Cancel a certificate. Its page then says so; it can be issued again afterwards. */
export async function revokeCertificate(code: string, reason: string | null) {
  const existing = await prisma.certificate.findUnique({
    where: { code: normalizeCertificateCode(code) },
    select: { id: true, code: true, classId: true, revokedAt: true },
  });
  if (!existing) return null;
  if (existing.revokedAt) return existing;
  return prisma.certificate.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), revokedReason: clean(reason, 300), activeKey: null },
    select: { id: true, code: true, classId: true, revokedAt: true },
  });
}

function certificateMessage(kind: CertificateKind, className: string, code: string): string {
  const url = certificateVerifyUrl(code);
  const opening =
    kind === "TEACHER_RECOGNITION"
      ? [`Thank you for teaching "${className}".`, "AlphaSeekers has issued you a Certificate of Recognition for your teaching service."]
      : [`Congratulations on completing "${className}"!`, "AlphaSeekers has issued you a Certificate of Completion."];
  return [
    ...opening,
    "",
    `View, download or print it here: ${url}`,
    "",
    `Certificate ID: ${code}. Anyone can check it is genuine by scanning its QR code.`,
  ].join("\n");
}

const SUBJECT = "Your AlphaSeekers certificate";

/**
 * Email each new holder their link. English only (never machine-written Dari).
 * A few at a time: Gmail SMTP is the only mail route and it throttles bursts.
 */
export async function emailCertificateLinks(issued: IssuedCertificate[], className: string): Promise<number> {
  if (issued.length === 0) return 0;
  const userIds = issued.map((c) => c.userId).filter((id): id is string => Boolean(id));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, phone: true, telegramChatId: true, pushSubscription: true, notificationPrefs: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  let sent = 0;

  const queue = [...issued];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const content = certificateMessage(next.kind, className, next.code);
      try {
        const user = next.userId ? byId.get(next.userId) : undefined;
        if (!user) {
          // Typed in by hand with no account: email only, nothing to record against.
          if (next.email) {
            await sendDirectEmail(next.email, SUBJECT, content);
            sent += 1;
          }
          continue;
        }
        const deliveries = await deliverWithFallback(
          {
            userId: user.id,
            email: user.email,
            phone: user.phone,
            telegramChatId: user.telegramChatId,
            pushSubscription: user.pushSubscription,
            notificationPrefs: user.notificationPrefs,
          },
          content,
          { subject: SUBJECT },
        );
        // The in-site notice always "succeeds"; only a real message counts as sent.
        if (deliveries.some((d) => d.status === "SENT" && d.channel !== "PLATFORM")) sent += 1;
        if (deliveries.length > 0) {
          await prisma.notification.createMany({
            data: deliveries.map((delivery) => ({
              userId: user.id,
              dedupeKey: `certificate:${next.code}`,
              channel: delivery.channel,
              content,
              status: delivery.status,
              sentAt: new Date(),
            })),
            skipDuplicates: true,
          });
        }
      } catch {
        // One failed email must not stop the rest; the certificate itself is
        // already issued and staff can copy its link from the class page.
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return sent;
}
