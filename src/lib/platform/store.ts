import * as dbStore from "@/lib/platform/db-store";
import * as memoryStore from "@/lib/platform/memory-store";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { reportUsingDatabase, reportUsingMemory } from "@/lib/platform/fallback-state";

// Cached database availability. This is a *cache*, never a permanent latch: a
// single transient error (e.g. a Neon cold-start or network blip) must not brick
// the whole process into the in-memory store until restart. We re-probe on a
// cooldown, and invalidate the cache immediately after any infrastructure error.
let databaseMode: boolean | null = null;
let lastProbeAt = 0;

// How long a positive/negative availability result is trusted before re-probing.
// Short enough that a transient outage self-heals within seconds of recovery.
const AVAILABILITY_PROBE_TTL_MS = 30_000;

async function shouldUseDatabase(): Promise<boolean> {
  const now = Date.now();

  if (databaseMode !== null && now - lastProbeAt < AVAILABILITY_PROBE_TTL_MS) {
    return databaseMode;
  }

  databaseMode = await dbStore.isDatabaseAvailable();
  lastProbeAt = now;
  return databaseMode;
}

/**
 * Drop the cached availability result so the very next call re-probes the
 * database. Used after an infrastructure error instead of permanently latching
 * `databaseMode = false` — a transient blip should not permanently degrade the
 * process to the in-memory demo store.
 */
function invalidateDatabaseModeCache() {
  databaseMode = null;
  lastProbeAt = 0;
}

// Business-rule throws ("Class is full", "Student not found", "already enrolled",
// …) are NOT database-availability failures. They must propagate to the caller
// (which maps them to a 4xx) and must never trigger a fallback to memory or a
// re-probe. Genuine infra errors (connection refused, query timeout, Prisma
// engine errors) are everything else.
const BUSINESS_RULE_PATTERNS = [
  "not found",
  "is full",
  "already",
  "not enrolled",
  "not approved",
  "does not exist",
  "already exists",
];

function isBusinessRuleError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return BUSINESS_RULE_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * READ path: database-first, with an in-memory fallback that is ONLY allowed in
 * demo/dev (runtime.allowDbFallback). Reads are non-destructive, so serving a
 * stale/mock read from memory during a transient outage is acceptable in demo —
 * but never in production, where the database is the sole source of truth.
 *
 * Business-rule throws propagate unchanged; infra errors invalidate the
 * availability cache so the next call re-probes instead of latching to memory.
 */
async function runWithFallback<TDb, TMemory>(
  dbOperation: () => Promise<TDb>,
  memoryOperation: () => TMemory | Promise<TMemory>,
): Promise<TDb | TMemory> {
  warnIfInsecureProductionConfig();

  if (!runtime.allowDbFallback) {
    reportUsingDatabase();
    return dbOperation();
  }

  const useDatabase = await shouldUseDatabase();

  if (!useDatabase) {
    reportUsingMemory("database unavailable or not configured");
    return memoryOperation();
  }

  try {
    const result = await dbOperation();
    reportUsingDatabase();
    return result;
  } catch (error) {
    if (isBusinessRuleError(error)) {
      // Not an availability problem — surface it to the caller.
      throw error;
    }

    console.error("DB read failed; falling back to memory store (demo mode).", error);
    reportUsingMemory("database read failed; fell back to memory store", error);
    // Re-probe on the next call rather than permanently disabling the database.
    invalidateDatabaseModeCache();
    return memoryOperation();
  }
}

/**
 * WRITE path: database-only. A write MUST NOT silently fall back to memory — that
 * is exactly how enrollments, attendance and approvals were being lost. On a
 * database error we propagate so the caller returns 5xx and the client can retry.
 *
 * The single exception is demo/dev with NO configured/reachable database: there
 * the in-memory store is legitimately the backend of record, so we use it. Once a
 * real database is reachable, it is authoritative and errors are never swallowed.
 */
async function runWrite<TDb, TMemory>(
  dbOperation: () => Promise<TDb>,
  memoryOperation: () => TMemory | Promise<TMemory>,
): Promise<TDb | TMemory> {
  warnIfInsecureProductionConfig();

  if (runtime.allowDbFallback) {
    const useDatabase = await shouldUseDatabase();

    if (!useDatabase) {
      // Demo/dev with no real database configured: memory IS the backend of record.
      reportUsingMemory("database unavailable or not configured");
      return memoryOperation();
    }
  }

  // A database is authoritative (production, or demo with a reachable DB).
  // Never fall back to memory here: doing so would silently drop the write.
  try {
    const result = await dbOperation();
    reportUsingDatabase();
    return result;
  } catch (error) {
    if (!isBusinessRuleError(error)) {
      // Infra failure: let the next call re-probe instead of latching to memory.
      invalidateDatabaseModeCache();
    }

    throw error;
  }
}

export async function listClasses(params: { page?: number; limit?: number; search?: string } = {}) {
  return runWithFallback(() => dbStore.listClasses(params), () => memoryStore.listClasses(params));
}

export async function getClassById(classId: string) {
  return runWithFallback(() => dbStore.getClassById(classId), () => memoryStore.getClassById(classId));
}

export async function listClassEnrollments(classId: string) {
  return runWithFallback(() => dbStore.listClassEnrollments(classId), () => memoryStore.listClassEnrollments(classId));
}

export async function listClassAnnouncements(classId: string) {
  return runWithFallback(async () => dbStore.listClassAnnouncements(classId), () => memoryStore.listClassAnnouncements(classId));
}

export async function createClassAnnouncement(input: { classId: string; authorId: string; authorName: string; content: string }) {
  return runWrite(async () => dbStore.createClassAnnouncement(input), () => memoryStore.createClassAnnouncement(input));
}

export async function listUsersByRole(role: "STUDENT" | "TEACHER" | "ADMIN") {
  return runWithFallback(() => dbStore.listUsersByRole(role), () => memoryStore.listUsersByRole(role));
}

export async function listAdminClasses(params: { page?: number; limit?: number; search?: string } = {}) {
  return runWithFallback(() => dbStore.listAdminClasses(params), () => memoryStore.listAdminClasses(params));
}

export async function listAdminUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: "STUDENT" | "TEACHER" | "ADMIN" | "ALL";
  status?: "PENDING" | "APPROVED" | "ALL";
} = {}) {
  return runWithFallback(() => dbStore.listAdminUsers(params), () => memoryStore.listAdminUsers(params));
}

export async function setUserApproval(userId: string, approved: boolean) {
  return runWrite(() => dbStore.setUserApproval(userId, approved), () => memoryStore.setUserApproval(userId, approved));
}

export async function createClass(input: {
  name: string;
  subjectCategory: string;
  description: string;
  teacherId: string;
  maxStudents: number;
  durationMinutes: number;
  schedulePreference: string;
  language: string;
  registrationFormUrl?: string;
}) {
  return runWrite(() => dbStore.createClass(input), () => memoryStore.createClass(input));
}

export async function createClassWithSession(input: {
  name: string;
  subjectCategory: string;
  description: string;
  teacherId: string;
  maxStudents: number;
  durationMinutes: number;
  schedulePreference: string;
  language: string;
  registrationFormUrl?: string;
}) {
  return runWrite(() => dbStore.createClassWithSession(input), () => memoryStore.createClassWithSession(input));
}

export async function updateClass(
  classId: string,
  input: Partial<{
    name: string;
    subjectCategory: string;
    description: string;
    teacherId: string;
    maxStudents: number;
    durationMinutes: number;
    schedulePreference: string;
    language: string;
  }>,
) {
  return runWrite(() => dbStore.updateClass(classId, input), () => memoryStore.updateClass(classId, input));
}

export async function archiveClass(classId: string) {
  return runWrite(() => dbStore.archiveClass(classId), () => memoryStore.archiveClass(classId));
}

export async function enrollStudentInClass(studentId: string, classId: string) {
  return runWrite(() => dbStore.enrollStudentInClass(studentId, classId), () => memoryStore.enrollStudentInClass(studentId, classId));
}

export async function dropStudentFromClass(studentId: string, classId: string) {
  return runWrite(() => dbStore.dropStudentFromClass(studentId, classId), () => memoryStore.dropStudentFromClass(studentId, classId));
}

export async function isStudentEnrolledInClass(studentId: string, classId: string) {
  return runWithFallback(
    () => dbStore.isStudentEnrolledInClass(studentId, classId),
    () => memoryStore.isStudentEnrolledInClass(studentId, classId),
  );
}

export async function listStudentClasses(studentId: string) {
  return runWithFallback(() => dbStore.listStudentClasses(studentId), () => memoryStore.listStudentClasses(studentId));
}

export async function listStudentSchedule(studentId: string) {
  return runWithFallback(() => dbStore.listStudentSchedule(studentId), () => memoryStore.listStudentSchedule(studentId));
}

export async function getJoinNowSession(studentId: string) {
  return runWithFallback(() => dbStore.getJoinNowSession(studentId), () => memoryStore.getJoinNowSession(studentId));
}

export async function listTeacherAvailability(teacherId: string) {
  return runWithFallback(() => dbStore.listTeacherAvailability(teacherId), () => memoryStore.listTeacherAvailability(teacherId));
}

export async function replaceTeacherAvailability(
  teacherId: string,
  slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>,
) {
  return runWrite(
    () => dbStore.replaceTeacherAvailability(teacherId, slots),
    () => memoryStore.replaceTeacherAvailability(teacherId, slots),
  );
}

export async function runSchedulerBatch() {
  return runWrite(() => dbStore.runSchedulerBatch(), () => memoryStore.runSchedulerBatch());
}

export async function runReminderBatch() {
  return runWrite(() => dbStore.runReminderBatch(), () => memoryStore.runReminderBatch());
}

export async function listTodaySessions() {
  return runWithFallback(() => dbStore.listTodaySessions(), () => memoryStore.listTodaySessions());
}

export async function getDashboardStats() {
  return runWithFallback(() => dbStore.getDashboardStats(), () => memoryStore.getDashboardStats());
}

export async function listWebinars() {
  return runWithFallback(() => dbStore.listWebinars(), () => memoryStore.listWebinars());
}

export async function listRegisteredWebinarIds(userId: string) {
  return runWithFallback(
    () => dbStore.listRegisteredWebinarIds(userId),
    () => memoryStore.listRegisteredWebinarIds(userId),
  );
}

export async function createWebinar(input: {
  title: string;
  description: string;
  startsAt: string;
  meetLink: string;
  language: string;
}) {
  return runWrite(() => dbStore.createWebinar(input), () => memoryStore.createWebinar(input));
}

export async function registerForWebinar(webinarId: string, userId: string) {
  return runWrite(() => dbStore.registerForWebinar(webinarId, userId), () => memoryStore.registerForWebinar(webinarId, userId));
}

export async function listOpportunities(type?: string) {
  return runWithFallback(() => dbStore.listOpportunities(type), () => memoryStore.listOpportunities(type));
}

export async function createOpportunity(input: {
  title: string;
  type: "SCHOLARSHIP" | "JOB" | "INTERNSHIP" | "GRANT";
  description: string;
  deadline: string;
  externalUrl: string;
}) {
  return runWrite(() => dbStore.createOpportunity(input), () => memoryStore.createOpportunity(input));
}

export async function listLibraryResources(query?: string) {
  return runWithFallback(() => dbStore.listLibraryResources(query), () => memoryStore.listLibraryResources(query));
}

export async function createLibraryResource(input: {
  title: string;
  author: string;
  category: string;
  fileUrl: string;
  fileSize: number;
  externalUrl?: string;
}) {
  return runWrite(() => dbStore.createLibraryResource(input), () => memoryStore.createLibraryResource(input));
}

export async function listClassMaterials(classId: string) {
  return runWithFallback(() => dbStore.listClassMaterials(classId), () => memoryStore.listClassMaterials(classId));
}

export async function createClassMaterial(input: {
  classId: string;
  title: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
}) {
  return runWrite(() => dbStore.createClassMaterial(input), () => memoryStore.createClassMaterial(input));
}

export async function listUserNotifications(userId: string) {
  return runWithFallback(() => dbStore.listUserNotifications(userId), () => memoryStore.listUserNotifications(userId));
}

export async function getUser(userId: string) {
  return runWithFallback(() => dbStore.getUser(userId), () => memoryStore.getUser(userId));
}

export async function getStudentProfileSummary(studentId: string) {
  return runWithFallback(
    () => dbStore.getStudentProfileSummary(studentId),
    () => memoryStore.getStudentProfileSummary(studentId),
  );
}

export async function getSessionAttendance(sessionId: string) {
  return runWithFallback(
    () => dbStore.getSessionAttendance(sessionId),
    () => memoryStore.getSessionAttendance(sessionId),
  );
}

export async function markAttendance(sessionId: string, studentId: string, attended: boolean) {
  return runWrite(
    () => dbStore.markAttendance(sessionId, studentId, attended),
    () => memoryStore.markAttendance(sessionId, studentId, attended),
  );
}

export async function getClassAttendanceSummary(classId: string) {
  return runWithFallback(
    () => dbStore.getClassAttendanceSummary(classId),
    () => memoryStore.getClassAttendanceSummary(classId),
  );
}

export async function listTeacherClasses(teacherId: string) {
  return runWithFallback(
    () => dbStore.listTeacherClasses(teacherId),
    () => memoryStore.listTeacherClasses(teacherId),
  );
}

export async function getStudentAttendanceHistory(studentId: string) {
  return runWithFallback(
    () => dbStore.getStudentAttendanceHistory(studentId),
    () => memoryStore.getStudentAttendanceHistory(studentId),
  );
}

export async function getAdminAnalytics() {
  return runWithFallback(() => dbStore.getAdminAnalytics(), () => memoryStore.getAdminAnalytics());
}

export async function scheduleTeacherClasses(teacherId: string) {
  return runWrite(
    () => dbStore.scheduleTeacherClasses(teacherId),
    () => memoryStore.scheduleTeacherClasses(teacherId),
  );
}

export function parseInteger(input: string | null, fallback: number) {
  return dbStore.parseInteger(input, fallback);
}

export async function databaseEnabled() {
  return shouldUseDatabase();
}
