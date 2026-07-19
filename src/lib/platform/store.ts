// store.ts is now a thin facade over db-store: the in-memory fallback has been
// retired, so every operation delegates DIRECTLY to the database layer. A
// configured, reachable DATABASE_URL is therefore REQUIRED in every environment
// (dev/demo included). We still surface warnIfInsecureProductionConfig() and
// report "database" via reportUsingDatabase() so the admin system-status route
// keeps reporting the store mode honestly.
import * as dbStore from "@/lib/platform/db-store";
import { runtime, warnIfInsecureProductionConfig } from "@/lib/runtime";
import { reportUsingDatabase } from "@/lib/platform/fallback-state";

/**
 * Every store operation funnels through here so the two side effects that used
 * to live in the fallback wrappers are preserved exactly:
 *  - warnIfInsecureProductionConfig() runs on each call (it self-latches after
 *    the first warning), and
 *  - reportUsingDatabase() keeps the fallback-state reporting "database" for the
 *    admin system-status route.
 * It is a transparent pass-through: the operation's return type is preserved.
 */
function viaDatabase<T>(operation: () => T): T {
  warnIfInsecureProductionConfig();
  reportUsingDatabase();
  return operation();
}

export async function listClasses(params: { page?: number; limit?: number; search?: string } = {}) {
  return viaDatabase(() => dbStore.listClasses(params));
}

export async function getClassById(classId: string) {
  return viaDatabase(() => dbStore.getClassById(classId));
}

export async function listClassEnrollments(classId: string) {
  return viaDatabase(() => dbStore.listClassEnrollments(classId));
}

export async function listClassAnnouncements(classId: string) {
  return viaDatabase(() => dbStore.listClassAnnouncements(classId));
}

export async function createClassAnnouncement(input: { classId: string; authorId: string; authorName: string; content: string }) {
  return viaDatabase(() => dbStore.createClassAnnouncement(input));
}

export async function listUsersByRole(role: "STUDENT" | "TEACHER" | "ADMIN") {
  return viaDatabase(() => dbStore.listUsersByRole(role));
}

export async function listAdminClasses(params: { page?: number; limit?: number; search?: string } = {}) {
  return viaDatabase(() => dbStore.listAdminClasses(params));
}

export async function getAdminClassStats() {
  return viaDatabase(() => dbStore.getAdminClassStats());
}

export async function listAdminUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: "STUDENT" | "TEACHER" | "ADMIN" | "ALL";
  status?: "PENDING" | "APPROVED" | "ALL";
} = {}) {
  return viaDatabase(() => dbStore.listAdminUsers(params));
}

export async function setUserApproval(userId: string, approved: boolean) {
  return viaDatabase(() => dbStore.setUserApproval(userId, approved));
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
  whatsappGroupUrl?: string;
  schedulingMode?: "AUTO" | "MANUAL";
}) {
  return viaDatabase(() => dbStore.createClass(input));
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
  whatsappGroupUrl?: string;
  schedulingMode?: "AUTO" | "MANUAL";
}) {
  return viaDatabase(() => dbStore.createClassWithSession(input));
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
  return viaDatabase(() => dbStore.updateClass(classId, input));
}

export async function archiveClass(classId: string) {
  return viaDatabase(() => dbStore.archiveClass(classId));
}

export async function enrollStudentInClass(studentId: string, classId: string) {
  return viaDatabase(() => dbStore.enrollStudentInClass(studentId, classId));
}

export async function dropStudentFromClass(studentId: string, classId: string) {
  return viaDatabase(() => dbStore.dropStudentFromClass(studentId, classId));
}

export async function isStudentEnrolledInClass(studentId: string, classId: string) {
  return viaDatabase(() => dbStore.isStudentEnrolledInClass(studentId, classId));
}

export async function listStudentClasses(studentId: string) {
  return viaDatabase(() => dbStore.listStudentClasses(studentId));
}

export async function listStudentSchedule(studentId: string) {
  return viaDatabase(() => dbStore.listStudentSchedule(studentId));
}

export async function getJoinNowSession(studentId: string) {
  return viaDatabase(() => dbStore.getJoinNowSession(studentId));
}

export async function listTeacherAvailability(teacherId: string) {
  return viaDatabase(() => dbStore.listTeacherAvailability(teacherId));
}

export async function replaceTeacherAvailability(
  teacherId: string,
  slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>,
) {
  return viaDatabase(() => dbStore.replaceTeacherAvailability(teacherId, slots));
}

export async function runSchedulerBatch() {
  return viaDatabase(() => dbStore.runSchedulerBatch());
}

export async function runReminderBatch() {
  return viaDatabase(() => dbStore.runReminderBatch());
}

export async function listTodaySessions() {
  return viaDatabase(() => dbStore.listTodaySessions());
}

export async function getDashboardStats() {
  return viaDatabase(() => dbStore.getDashboardStats());
}

export async function listWebinars() {
  return viaDatabase(() => dbStore.listWebinars());
}

export async function listRegisteredWebinarIds(userId: string) {
  return viaDatabase(() => dbStore.listRegisteredWebinarIds(userId));
}

export async function createWebinar(input: {
  title: string;
  description: string;
  startsAt: string;
  meetLink: string;
  language: string;
}) {
  return viaDatabase(() => dbStore.createWebinar(input));
}

export async function registerForWebinar(webinarId: string, userId: string) {
  return viaDatabase(() => dbStore.registerForWebinar(webinarId, userId));
}

export async function listOpportunities(type?: string) {
  return viaDatabase(() => dbStore.listOpportunities(type));
}

export async function createOpportunity(input: {
  title: string;
  type: "SCHOLARSHIP" | "JOB" | "INTERNSHIP" | "GRANT";
  description: string;
  deadline: string;
  externalUrl: string;
}) {
  return viaDatabase(() => dbStore.createOpportunity(input));
}

export async function listLibraryResources(query?: string) {
  return viaDatabase(() => dbStore.listLibraryResources(query));
}

export async function createLibraryResource(input: {
  title: string;
  author: string;
  category: string;
  fileUrl: string;
  fileSize: number;
  externalUrl?: string;
}) {
  return viaDatabase(() => dbStore.createLibraryResource(input));
}

export async function listClassMaterials(classId: string) {
  return viaDatabase(() => dbStore.listClassMaterials(classId));
}

export async function createClassMaterial(input: {
  classId: string;
  title: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
}) {
  return viaDatabase(() => dbStore.createClassMaterial(input));
}

export async function listUserNotifications(userId: string) {
  return viaDatabase(() => dbStore.listUserNotifications(userId));
}

export async function getUser(userId: string) {
  return viaDatabase(() => dbStore.getUser(userId));
}

export async function getStudentProfileSummary(studentId: string) {
  return viaDatabase(() => dbStore.getStudentProfileSummary(studentId));
}

export async function getSessionAttendance(sessionId: string) {
  return viaDatabase(() => dbStore.getSessionAttendance(sessionId));
}

export async function markAttendance(sessionId: string, studentId: string, attended: boolean) {
  return viaDatabase(() => dbStore.markAttendance(sessionId, studentId, attended));
}

export async function getClassAttendanceSummary(classId: string) {
  return viaDatabase(() => dbStore.getClassAttendanceSummary(classId));
}

export async function listTeacherClasses(teacherId: string) {
  return viaDatabase(() => dbStore.listTeacherClasses(teacherId));
}

export async function getStudentAttendanceHistory(studentId: string) {
  return viaDatabase(() => dbStore.getStudentAttendanceHistory(studentId));
}

export async function getAdminAnalytics() {
  return viaDatabase(() => dbStore.getAdminAnalytics());
}

export async function scheduleTeacherClasses(teacherId: string) {
  return viaDatabase(() => dbStore.scheduleTeacherClasses(teacherId));
}

export function parseInteger(input: string | null, fallback: number) {
  return dbStore.parseInteger(input, fallback);
}

export async function databaseEnabled() {
  // Fallback retired: when the fallback is disallowed (production), the database
  // is mandatory and therefore always "enabled". In demo/dev we still probe so a
  // missing/unreachable database is reported honestly.
  if (!runtime.allowDbFallback) {
    return true;
  }
  return dbStore.isDatabaseAvailable();
}
