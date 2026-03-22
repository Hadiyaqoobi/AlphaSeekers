#!/usr/bin/env node
/* eslint-disable no-console */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  addFromSetCookie(setCookie) {
    if (!setCookie || typeof setCookie !== "string") return;
    const firstPart = setCookie.split(";")[0] ?? "";
    const eq = firstPart.indexOf("=");
    if (eq <= 0) return;
    const name = firstPart.slice(0, eq).trim();
    const value = firstPart.slice(eq + 1).trim();
    if (!name) return;
    this.cookies.set(name, value);
  }
}

async function fetchWithJar(jar, path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (jar && jar.cookies.size > 0 && !headers.has("cookie")) {
    headers.set("cookie", jar.header());
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    redirect: init.redirect ?? "manual",
  });

  if (jar && typeof res.headers.getSetCookie === "function") {
    for (const setCookie of res.headers.getSetCookie()) {
      jar.addFromSetCookie(setCookie);
    }
  }

  return res;
}

async function jsonOrText(res) {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

async function expectOkJson(jar, path, init) {
  const res = await fetchWithJar(jar, path, init);
  const body = await jsonOrText(res);
  if (!res.ok) {
    const details = typeof body === "string" ? body.slice(0, 280) : JSON.stringify(body).slice(0, 280);
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}. ${details}`);
  }
  return body;
}

async function login(email, password) {
  const jar = new CookieJar();
  const csrf = await expectOkJson(jar, "/api/auth/csrf", { headers: { accept: "application/json" } });
  assert(csrf && typeof csrf === "object" && csrf.csrfToken, "Expected CSRF token");

  const form = new URLSearchParams();
  form.set("csrfToken", csrf.csrfToken);
  form.set("email", email);
  form.set("password", password);
  form.set("callbackUrl", `${BASE_URL}/fa/dashboard`);
  form.set("json", "true");

  const res = await fetchWithJar(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });

  // NextAuth returns 302 on success, 401 for pending approval, and may return 200 when json=true is honored.
  if (!(res.status === 200 || res.status === 302 || res.status === 401)) {
    const body = await jsonOrText(res);
    throw new Error(`Login callback failed: ${res.status} ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }

  // Give NextAuth a moment to commit cookie writes.
  await sleep(50);
  const session = await expectOkJson(jar, "/api/auth/session", { headers: { accept: "application/json" } });

  return { jar, session };
}

async function mustLogin(email, password, expectedRole) {
  const { jar, session } = await login(email, password);
  const role = session?.user?.role;
  assert(role === expectedRole, `Expected role ${expectedRole}, got ${role ?? "null"}`);
  return { jar, session };
}

async function scenarioAccessControls({ adminJar, teacherJar, studentJar }) {
  console.log("Scenario: access controls");

  // Non-admins should be blocked from admin APIs.
  const teacherAdminAttempt = await fetchWithJar(teacherJar, "/api/admin/classes", { headers: { accept: "application/json" } });
  assert(teacherAdminAttempt.status === 403, `Teacher should get 403 on /api/admin/classes, got ${teacherAdminAttempt.status}`);

  const studentAdminAttempt = await fetchWithJar(studentJar, "/api/admin/classes", { headers: { accept: "application/json" } });
  assert(studentAdminAttempt.status === 403, `Student should get 403 on /api/admin/classes, got ${studentAdminAttempt.status}`);

  // Anonymous should get 401 on protected APIs.
  const anon = new CookieJar();
  const anonClassesAttempt = await fetchWithJar(anon, "/api/classes", { headers: { accept: "application/json" } });
  assert(anonClassesAttempt.status === 401, `Anon should get 401 on /api/classes, got ${anonClassesAttempt.status}`);

  // Admin should be allowed to call cron endpoints (without exposing CRON_SECRET to browser).
  const schedulerRes = await fetchWithJar(adminJar, "/api/cron/scheduler", { method: "POST", headers: { accept: "application/json" } });
  assert(schedulerRes.status === 200, `Admin should be able to POST /api/cron/scheduler, got ${schedulerRes.status}`);

  const remindersRes = await fetchWithJar(adminJar, "/api/cron/reminders", { method: "POST", headers: { accept: "application/json" } });
  assert(remindersRes.status === 200, `Admin should be able to POST /api/cron/reminders, got ${remindersRes.status}`);
}

async function scenarioCreateClassAndSchedule(adminJar) {
  console.log("Scenario: admin creates class, scheduler creates sessions");

  const teachers = await expectOkJson(adminJar, "/api/admin/users?role=TEACHER&status=APPROVED&limit=1&page=1", {
    headers: { accept: "application/json" },
  });
  const teacher = teachers?.items?.[0];
  assert(teacher?.id, "Expected at least one approved teacher");

  const name = `E2E Test Class ${randomToken()}`;
  const created = await expectOkJson(adminJar, "/api/admin/classes", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      name,
      subjectCategory: "Languages",
      description: "E2E test class created by smoke script.",
      teacherId: teacher.id,
      maxStudents: 15,
      durationMinutes: 90,
      schedulePreference: "Tue 6:00 PM",
      language: "English",
    }),
  });

  assert(created?.id, "Expected created class id");

  // Run scheduler until sessions exist for this class.
  for (let i = 0; i < 6; i += 1) {
    await expectOkJson(adminJar, "/api/cron/scheduler", { method: "POST", headers: { accept: "application/json" } });
    const record = await expectOkJson(adminJar, `/api/classes/${created.id}`, { headers: { accept: "application/json" } });
    if (Array.isArray(record.sessions) && record.sessions.length > 0) {
      return { classId: created.id, teacherId: teacher.id };
    }
    await sleep(200);
  }

  throw new Error("Scheduler did not create sessions for the new class");
}

async function scenarioTeacherFlow(teacherJar, classId) {
  console.log("Scenario: teacher manages availability and materials");

  // Availability read/update.
  const initial = await expectOkJson(teacherJar, "/api/teacher/availability", { headers: { accept: "application/json" } });
  assert(Array.isArray(initial.items), "Expected availability items array");

  const updated = await expectOkJson(teacherJar, "/api/teacher/availability", {
    method: "PUT",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      slots: [
        { dayOfWeek: 2, startMinute: 18 * 60, endMinute: 20 * 60 }, // Tue 18:00-20:00 UTC
        { dayOfWeek: 4, startMinute: 18 * 60, endMinute: 20 * 60 }, // Thu 18:00-20:00 UTC
      ],
    }),
  });
  assert(Array.isArray(updated.items) && updated.items.length >= 1, "Expected updated availability");

  // Teacher should see private class details (meet links can be present).
  const klass = await expectOkJson(teacherJar, `/api/classes/${classId}`, { headers: { accept: "application/json" } });
  assert(klass?.id === classId, "Expected class detail");
  assert(Array.isArray(klass.sessions) && klass.sessions.length > 0, "Expected sessions");

  // Upload a material.
  const materialTitle = `Lesson notes ${randomToken()}`;
  const created = await expectOkJson(teacherJar, `/api/classes/${classId}/materials`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      title: materialTitle,
      fileUrl: "https://example-r2.alphaseekers.org/materials/e2e-notes.pdf",
      fileSize: 120_000,
    }),
  });
  assert(created?.id, "Expected created material id");

  const list = await expectOkJson(teacherJar, `/api/classes/${classId}/materials`, { headers: { accept: "application/json" } });
  assert(Array.isArray(list.items), "Expected materials list");
  assert(list.items.some((m) => m.title === materialTitle), "Expected uploaded material to appear in list");
}

async function scenarioStudentFlow(studentJar, classId, adminJar) {
  console.log("Scenario: student browses, enrolls, sees meet links, registers webinar");

  // Before enrollment: meet links should be hidden via safe response.
  const before = await expectOkJson(studentJar, `/api/classes/${classId}`, { headers: { accept: "application/json" } });
  assert(Array.isArray(before.sessions) && before.sessions.length > 0, "Expected sessions in class detail");
  assert(before.sessions.every((s) => s.meetLink === null), "Expected meet links hidden before enrollment");

  // Enrollment.
  await expectOkJson(studentJar, `/api/classes/${classId}/enroll`, { method: "POST", headers: { accept: "application/json" } });

  const after = await expectOkJson(studentJar, `/api/classes/${classId}`, { headers: { accept: "application/json" } });
  assert(Array.isArray(after.sessions) && after.sessions.length > 0, "Expected sessions after enrollment");
  // Meet links might still be pending in some environments; accept either generated or pending, but links should not be forcibly nulled.
  assert(after.sessions.some((s) => s.meetLink !== null) || after.sessions.some((s) => s.meetLinkStatus !== "GENERATED"), "Expected access to private session details after enrollment");

  // Student cannot upload materials.
  const materialAttempt = await fetchWithJar(studentJar, `/api/classes/${classId}/materials`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ title: "Bad", fileUrl: "https://example.com/a.pdf", fileSize: 1 }),
  });
  assert(materialAttempt.status === 403, `Student upload should be 403, got ${materialAttempt.status}`);

  // Schedule endpoints.
  const schedule = await expectOkJson(studentJar, "/api/me/schedule", { headers: { accept: "application/json" } });
  assert(Array.isArray(schedule.items), "Expected schedule items array");

  const profile = await expectOkJson(studentJar, "/api/me/profile", { headers: { accept: "application/json" } });
  assert(profile?.student?.id, "Expected student profile summary");

  // Webinar meet link should be hidden until registration.
  const webinars = await expectOkJson(studentJar, "/api/webinars", { headers: { accept: "application/json" } });
  let webinar = webinars?.items?.find((item) => item?.registered !== true && item?.meetLink === null);

  if (!webinar) {
    assert(adminJar, "Need admin jar to create a webinar for registration test");
    const token = randomToken();
    const title = `E2E Webinar ${token}`;
    const startsAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();

    await expectOkJson(adminJar, "/api/webinars", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        title,
        description: "E2E webinar created by smoke script.",
        startsAt,
        meetLink: `https://meet.google.com/e2e-${token}`,
        language: "English",
      }),
    });

    const webinarsRefresh = await expectOkJson(studentJar, "/api/webinars", { headers: { accept: "application/json" } });
    webinar = webinarsRefresh?.items?.find((item) => item?.title === title) ??
      webinarsRefresh?.items?.find((item) => item?.registered !== true && item?.meetLink === null);
  }

  assert(webinar?.id, "Expected at least one webinar");
  assert(webinar.meetLink === null, "Expected webinar meet link hidden before registration");

  await expectOkJson(studentJar, `/api/webinars/${webinar.id}/register`, { method: "POST", headers: { accept: "application/json" } });
  const webinarsAfter = await expectOkJson(studentJar, "/api/webinars", { headers: { accept: "application/json" } });
  const updated = webinarsAfter.items.find((w) => w.id === webinar.id);
  assert(updated?.registered === true, "Expected webinar registered flag");
  assert(typeof updated?.meetLink === "string" && updated.meetLink.length > 0, "Expected webinar meet link after registration");
}

async function scenarioApprovalGate(adminJar) {
  console.log("Scenario: approval gate blocks unapproved accounts until admin approval");

  const password = `pw${randomToken()}123`;
  const email = `e2e_student_${randomToken()}@example.com`;

  const created = await expectOkJson(null, "/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      name: "E2E Pending Student",
      email,
      password,
      role: "STUDENT",
      language: "EN",
      timezone: "UTC",
    }),
  });

  assert(created?.id, "Expected registered user id");

  const pendingLogin = await login(email, password);
  const pendingRole = pendingLogin.session?.user?.role;
  assert(!pendingRole, "Expected pending user not to have a session yet");

  const pending = await expectOkJson(adminJar, "/api/admin/users?status=PENDING&limit=25&page=1", {
    headers: { accept: "application/json" },
  });
  const found = pending?.items?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  assert(found?.id, "Expected pending user to appear in admin list");

  await expectOkJson(adminJar, `/api/admin/users/${found.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ approved: true }),
  });

  const approvedLogin = await mustLogin(email, password, "STUDENT");
  assert(approvedLogin.session?.user?.role === "STUDENT", "Expected approved user to sign in");
}

async function scenarioCatalogApis(studentJar) {
  console.log("Scenario: catalog APIs return data for approved users");

  const classes = await expectOkJson(studentJar, "/api/classes?page=1&limit=5", { headers: { accept: "application/json" } });
  assert(Array.isArray(classes?.items), "Expected classes.items array");

  const library = await expectOkJson(studentJar, "/api/library", { headers: { accept: "application/json" } });
  assert(Array.isArray(library?.items), "Expected library.items array");

  const opportunities = await expectOkJson(studentJar, "/api/opportunities", { headers: { accept: "application/json" } });
  assert(Array.isArray(opportunities?.items), "Expected opportunities.items array");
}

async function archiveClass(adminJar, classId) {
  const res = await fetchWithJar(adminJar, `/api/admin/classes/${classId}`, {
    method: "DELETE",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const body = await jsonOrText(res);
    console.warn(`WARN: unable to archive class ${classId}: ${res.status}`, body);
  }
}

async function main() {
  console.log(`Smoke starting against ${BASE_URL}`);
  const health = await expectOkJson(null, "/api/health", { headers: { accept: "application/json" } });
  assert(health?.ok === true, "Expected /api/health ok");

  const { jar: adminJar } = await mustLogin("admin@alphaseekers.org", "admin123", "ADMIN");
  const { jar: teacherJar } = await mustLogin("teacher@alphaseekers.org", "teacher123", "TEACHER");
  const { jar: studentJar } = await mustLogin("student@alphaseekers.org", "student123", "STUDENT");

  await scenarioAccessControls({ adminJar, teacherJar, studentJar });

  let testClassId = null;
  try {
    const created = await scenarioCreateClassAndSchedule(adminJar);
    testClassId = created.classId;

    await scenarioTeacherFlow(teacherJar, testClassId);
    await scenarioStudentFlow(studentJar, testClassId, adminJar);
    await scenarioCatalogApis(studentJar);
    await scenarioApprovalGate(adminJar);
  } finally {
    if (testClassId) {
      await archiveClass(adminJar, testClassId);
    }
  }

  console.log("Smoke completed OK");
}

main().catch((error) => {
  console.error("Smoke failed:", error?.stack ?? error);
  process.exitCode = 1;
});
