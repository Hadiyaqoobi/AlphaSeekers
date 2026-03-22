import * as dbStore from "@/lib/platform/db-store";
import * as memoryStore from "@/lib/platform/memory-store";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { reportUsingDatabase, reportUsingMemory } from "@/lib/platform/fallback-state";

let databaseMode: boolean | null = null;

async function shouldUseDatabase() {
  if (databaseMode !== null) {
    return databaseMode;
  }

  databaseMode = await dbStore.isDatabaseAvailable();
  return databaseMode;
}

function disableDatabaseMode() {
  databaseMode = false;
}

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
    console.error("DB mode failed, falling back to memory store.", error);
    reportUsingMemory("database operation failed; fell back to memory store", error);
    disableDatabaseMode();
    return memoryOperation();
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
  return runWithFallback(async () => dbStore.createClassAnnouncement(input), () => memoryStore.createClassAnnouncement(input));
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
  return runWithFallback(() => dbStore.setUserApproval(userId, approved), () => memoryStore.setUserApproval(userId, approved));
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
  return runWithFallback(() => dbStore.createClass(input), () => memoryStore.createClass(input));
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
  return runWithFallback(() => dbStore.createClassWithSession(input), () => memoryStore.createClassWithSession(input));
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
  return runWithFallback(() => dbStore.updateClass(classId, input), () => memoryStore.updateClass(classId, input));
}

export async function archiveClass(classId: string) {
  return runWithFallback(() => dbStore.archiveClass(classId), () => memoryStore.archiveClass(classId));
}

export async function enrollStudentInClass(studentId: string, classId: string) {
  return runWithFallback(() => dbStore.enrollStudentInClass(studentId, classId), () => memoryStore.enrollStudentInClass(studentId, classId));
}

export async function dropStudentFromClass(studentId: string, classId: string) {
  return runWithFallback(() => dbStore.dropStudentFromClass(studentId, classId), () => memoryStore.dropStudentFromClass(studentId, classId));
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
  return runWithFallback(
    () => dbStore.replaceTeacherAvailability(teacherId, slots),
    () => memoryStore.replaceTeacherAvailability(teacherId, slots),
  );
}

export async function runSchedulerBatch() {
  return runWithFallback(() => dbStore.runSchedulerBatch(), () => memoryStore.runSchedulerBatch());
}

export async function runReminderBatch() {
  return runWithFallback(() => dbStore.runReminderBatch(), () => memoryStore.runReminderBatch());
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
  return runWithFallback(() => dbStore.createWebinar(input), () => memoryStore.createWebinar(input));
}

export async function registerForWebinar(webinarId: string, userId: string) {
  return runWithFallback(() => dbStore.registerForWebinar(webinarId, userId), () => memoryStore.registerForWebinar(webinarId, userId));
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
  return runWithFallback(() => dbStore.createOpportunity(input), () => memoryStore.createOpportunity(input));
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
  return runWithFallback(() => dbStore.createLibraryResource(input), () => memoryStore.createLibraryResource(input));
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
  return runWithFallback(() => dbStore.createClassMaterial(input), () => memoryStore.createClassMaterial(input));
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
  return runWithFallback(
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
  return runWithFallback(
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
