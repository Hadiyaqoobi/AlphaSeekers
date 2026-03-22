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

async function expectStatus(jar, path, expectedStatus, init = {}) {
  const res = await fetchWithJar(jar, path, init);
  if (res.status !== expectedStatus) {
    const body = await jsonOrText(res);
    const details = typeof body === "string" ? body.slice(0, 280) : JSON.stringify(body).slice(0, 280);
    throw new Error(`${init?.method ?? "GET"} ${path} expected ${expectedStatus} but got ${res.status}. ${details}`);
  }
  return res;
}

async function expectOkHtml(jar, path) {
  const res = await fetchWithJar(jar, path, { headers: { accept: "text/html" } });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${path} expected 200 but got ${res.status}. ${body.slice(0, 280)}`);
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

  let callbackPayload = null;
  try {
    callbackPayload = await jsonOrText(res.clone());
  } catch {
    callbackPayload = null;
  }

  // NextAuth returns 302 on success, 401 for pending approval, and may return 200 when json=true is honored.
  if (!(res.status === 200 || res.status === 302 || res.status === 401)) {
    throw new Error(
      `Login callback failed: ${res.status} ${typeof callbackPayload === "string" ? callbackPayload : JSON.stringify(callbackPayload)}`,
    );
  }

  // Give NextAuth a moment to commit cookie writes.
  await sleep(50);
  const session = await expectOkJson(jar, "/api/auth/session", { headers: { accept: "application/json" } });

  return {
    jar,
    session,
    callback: {
      status: res.status,
      location: res.headers.get("location"),
      payload: callbackPayload,
    },
  };
}

async function mustLogin(email, password, expectedRole) {
  const { jar, session } = await login(email, password);
  const role = session?.user?.role;
  assert(role === expectedRole, `Expected role ${expectedRole}, got ${role ?? "null"}`);
  return { jar, session };
}

async function runStory(id, title, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    console.log(`✓ ${id} ${title} (${Date.now() - startedAt}ms)`);
    return { id, title, ok: true };
  } catch (error) {
    console.error(`✗ ${id} ${title}`);
    console.error(error?.stack ?? error);
    return { id, title, ok: false, error };
  }
}

async function listApprovedTeachers(adminJar, limit = 25) {
  return expectOkJson(adminJar, `/api/admin/users?role=TEACHER&status=APPROVED&limit=${limit}&page=1`, {
    headers: { accept: "application/json" },
  });
}

async function createClass(adminJar, input) {
  const response = await expectOkJson(adminJar, "/api/admin/classes", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      name: input.name,
      subjectCategory: input.subjectCategory ?? "Languages",
      description: input.description ?? "Automated test class.",
      teacherId: input.teacherId,
      maxStudents: input.maxStudents ?? 15,
      durationMinutes: input.durationMinutes ?? 60,
      schedulePreference: input.schedulePreference ?? "Tue 6:00 PM",
      language: input.language ?? "English",
    }),
  });

  assert(response?.id, "Expected created class id");
  return response;
}

async function runSchedulerBatch(adminJar) {
  return expectOkJson(adminJar, "/api/cron/scheduler", { method: "POST", headers: { accept: "application/json" } });
}

async function waitForClassSessions(adminJar, classId) {
  for (let i = 0; i < 10; i += 1) {
    await runSchedulerBatch(adminJar);
    const record = await expectOkJson(adminJar, `/api/classes/${classId}`, { headers: { accept: "application/json" } });
    if (Array.isArray(record.sessions) && record.sessions.length > 0) {
      return record;
    }
    await sleep(250);
  }

  throw new Error("Scheduler did not create sessions for the new class");
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

async function enroll(studentJar, classId) {
  return expectOkJson(studentJar, `/api/classes/${classId}/enroll`, { method: "POST", headers: { accept: "application/json" } });
}

async function unenroll(studentJar, classId) {
  return expectOkJson(studentJar, `/api/classes/${classId}/enroll`, { method: "DELETE", headers: { accept: "application/json" } });
}

async function uploadMaterial(jar, classId, title) {
  return expectOkJson(jar, `/api/classes/${classId}/materials`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      title,
      fileUrl: "https://example-r2.alphaseekers.org/materials/e2e-notes.pdf",
      fileSize: 120_000,
    }),
  });
}

async function main() {
  console.log(`Story tests starting against ${BASE_URL}`);

  const health = await expectOkJson(null, "/api/health", { headers: { accept: "application/json" } });
  assert(health?.ok === true, "Expected /api/health ok");

  const localeSanity = await runStory("UI-01", "Locale pages render correct language + dir (FA + EN)", async () => {
    const fa = await expectOkHtml(null, "/fa");
    assert(fa.includes('dir="rtl"'), "Expected /fa to render RTL");
    assert(fa.includes("خانه"), "Expected /fa to render Persian nav");
    assert(fa.includes("آموزش رایگان برای دختران افغان"), "Expected /fa to include Persian tagline");

    const en = await expectOkHtml(null, "/en");
    assert(en.includes('dir="ltr"'), "Expected /en to render LTR");
    assert(en.includes(">Home<"), "Expected /en to render English nav");
    assert(en.includes("Free education for Afghan girls"), "Expected /en to include English tagline");
    assert(!en.includes("خانه"), "Expected /en not to include Persian nav strings");
  });

  const { jar: adminJar } = await mustLogin("admin@alphaseekers.org", "admin123", "ADMIN");
  const { jar: teacherJar } = await mustLogin("teacher@alphaseekers.org", "teacher123", "TEACHER");
  const { jar: studentJar } = await mustLogin("student@alphaseekers.org", "student123", "STUDENT");

  const testToken = randomToken();
  const primaryTeacherId = "demo-teacher";
  const teacherList = await listApprovedTeachers(adminJar, 50);
  const otherTeacher = teacherList?.items?.find((item) => item?.id && item.id !== primaryTeacherId) ?? null;
  assert(otherTeacher?.id, "Expected at least two approved teachers (demo teacher + another).");

  const primaryClass = await createClass(adminJar, {
    name: `US Test Class ${testToken}`,
    teacherId: primaryTeacherId,
    durationMinutes: 90,
    schedulePreference: "Tue 6:00 PM",
  });

  const otherTeacherClass = await createClass(adminJar, {
    name: `US Other Teacher Class ${testToken}`,
    teacherId: otherTeacher.id,
    durationMinutes: 60,
    schedulePreference: "Thu 6:00 PM",
  });

  await waitForClassSessions(adminJar, primaryClass.id);

  const ctx = {
    pendingEmail: null,
    pendingPassword: null,
  };

  const results = [];
  results.push(localeSanity);

  results.push(
    await runStory("UI-02", "Logged-in UI renders in both locales (dashboard/classes/profile)", async () => {
      const faDashboard = await expectOkHtml(studentJar, "/fa/dashboard");
      assert(faDashboard.includes("داشبورد"), "Expected /fa/dashboard to render Persian dashboard label");

      const enDashboard = await expectOkHtml(studentJar, "/en/dashboard");
      assert(enDashboard.includes(">Dashboard<"), "Expected /en/dashboard to render English dashboard label");

      const faClasses = await expectOkHtml(studentJar, "/fa/classes");
      assert(faClasses.includes("صنف‌ها"), "Expected /fa/classes to render Persian classes title");

      const enClasses = await expectOkHtml(studentJar, "/en/classes");
      assert(enClasses.includes(">Classes<"), "Expected /en/classes to render English classes title");

      const faProfile = await expectOkHtml(studentJar, "/fa/profile");
      assert(faProfile.includes("پروفایل"), "Expected /fa/profile to render Persian profile label");

      const enProfile = await expectOkHtml(studentJar, "/en/profile");
      assert(enProfile.includes("Student profile"), "Expected /en/profile to render English student profile title");
    }),
  );

  results.push(
    await runStory("US-01", "Request access creates pending account (blocked sign-in)", async () => {
      const password = `pw${randomToken()}123`;
      const email = `e2e_pending_${randomToken()}@example.com`;

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
      ctx.pendingEmail = email;
      ctx.pendingPassword = password;

      const attempt = await login(email, password);
      assert(attempt.callback.status === 401, `Expected pending login callback 401, got ${attempt.callback.status}`);
      assert(
        typeof attempt.callback.payload?.url === "string" &&
          attempt.callback.payload.url.includes("PENDING_APPROVAL"),
        "Expected PENDING_APPROVAL login error",
      );
      assert(!attempt.session?.user?.role, "Expected pending user not to have a valid session");
    }),
  );

  results.push(
    await runStory("US-02", "Admin approves pending account (only admins can approve)", async () => {
      assert(ctx.pendingEmail && ctx.pendingPassword, "Missing pending user created by US-01");

      // Non-admins blocked from admin APIs.
      await expectStatus(teacherJar, "/api/admin/users?status=PENDING&limit=1&page=1", 403, { headers: { accept: "application/json" } });
      await expectStatus(studentJar, "/api/admin/users?status=PENDING&limit=1&page=1", 403, { headers: { accept: "application/json" } });

      const pending = await expectOkJson(
        adminJar,
        `/api/admin/users?status=PENDING&search=${encodeURIComponent(ctx.pendingEmail)}&limit=10&page=1`,
        { headers: { accept: "application/json" } },
      );

      const found = pending?.items?.find((u) => u.email?.toLowerCase() === ctx.pendingEmail.toLowerCase());
      assert(found?.id, "Expected pending user to appear in admin list");

      await expectOkJson(adminJar, `/api/admin/users/${found.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ approved: true }),
      });

      const approvedLogin = await mustLogin(ctx.pendingEmail, ctx.pendingPassword, "STUDENT");
      assert(approvedLogin.session?.user?.role === "STUDENT", "Expected approved user to sign in");
    }),
  );

  results.push(
    await runStory("US-03", "Approved students can browse/search catalog (classes, library, opportunities)", async () => {
      const classes = await expectOkJson(studentJar, `/api/classes?search=${encodeURIComponent(testToken)}&page=1&limit=10`, {
        headers: { accept: "application/json" },
      });
      assert(Array.isArray(classes?.items), "Expected classes.items array");
      assert(classes.items.some((item) => item.id === primaryClass.id), "Expected search results to include test class");

      const library = await expectOkJson(studentJar, "/api/library", { headers: { accept: "application/json" } });
      assert(Array.isArray(library?.items), "Expected library.items array");

      const opportunities = await expectOkJson(studentJar, "/api/opportunities", { headers: { accept: "application/json" } });
      assert(Array.isArray(opportunities?.items), "Expected opportunities.items array");
    }),
  );

  results.push(
    await runStory("US-04", "Class detail hides Meet links/materials before enrollment", async () => {
      const asTeacher = await expectOkJson(teacherJar, `/api/classes/${primaryClass.id}`, { headers: { accept: "application/json" } });
      assert(asTeacher?.id === primaryClass.id, "Expected teacher class detail");
      assert(asTeacher.sessions?.some((s) => typeof s.meetLink === "string" && s.meetLink.length > 0), "Expected teacher to see meet links");

      const asStudent = await expectOkJson(studentJar, `/api/classes/${primaryClass.id}`, { headers: { accept: "application/json" } });
      assert(asStudent?.id === primaryClass.id, "Expected student class detail");
      assert(Array.isArray(asStudent.sessions) && asStudent.sessions.length > 0, "Expected sessions in class detail");
      assert(asStudent.sessions.every((s) => s.meetLink === null), "Expected student meet links hidden before enrollment");
      assert(Array.isArray(asStudent.materials) && asStudent.materials.length === 0, "Expected materials hidden before enrollment");

      await expectStatus(studentJar, `/api/classes/${primaryClass.id}/materials`, 403, { headers: { accept: "application/json" } });
    }),
  );

  results.push(
    await runStory("US-05", "Student enroll/unenroll toggles access", async () => {
      await enroll(studentJar, primaryClass.id);

      const afterEnroll = await expectOkJson(studentJar, `/api/classes/${primaryClass.id}`, { headers: { accept: "application/json" } });
      assert(afterEnroll.sessions?.some((s) => s.meetLink !== null), "Expected meet links visible after enrollment");

      const materialsOk = await expectOkJson(studentJar, `/api/classes/${primaryClass.id}/materials`, { headers: { accept: "application/json" } });
      assert(Array.isArray(materialsOk?.items), "Expected materials endpoint to return items");

      await unenroll(studentJar, primaryClass.id);

      const afterDrop = await expectOkJson(studentJar, `/api/classes/${primaryClass.id}`, { headers: { accept: "application/json" } });
      assert(afterDrop.sessions?.every((s) => s.meetLink === null), "Expected meet links hidden after unenrollment");

      await expectStatus(studentJar, `/api/classes/${primaryClass.id}/materials`, 403, { headers: { accept: "application/json" } });
    }),
  );

  results.push(
    await runStory("US-06", "Student schedule includes continuation for multi-segment classes", async () => {
      await enroll(studentJar, primaryClass.id);

      const schedule = await expectOkJson(studentJar, "/api/me/schedule", { headers: { accept: "application/json" } });
      assert(Array.isArray(schedule.items), "Expected schedule.items array");

      const items = schedule.items.filter((item) => item.classId === primaryClass.id);
      assert(items.length >= 2, "Expected multi-segment class to produce multiple schedule items");
      assert(items.some((item) => item.continuation?.sessionId), "Expected at least one continuation segment");

      await unenroll(studentJar, primaryClass.id);
    }),
  );

  results.push(
    await runStory("US-07", "Teacher can update availability; students cannot", async () => {
      const initial = await expectOkJson(teacherJar, "/api/teacher/availability", { headers: { accept: "application/json" } });
      assert(Array.isArray(initial.items), "Expected availability items array");

      const updated = await expectOkJson(teacherJar, "/api/teacher/availability", {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          slots: [
            { dayOfWeek: 2, startMinute: 18 * 60, endMinute: 20 * 60 },
            { dayOfWeek: 4, startMinute: 18 * 60, endMinute: 20 * 60 },
          ],
        }),
      });
      assert(Array.isArray(updated.items) && updated.items.length >= 1, "Expected updated availability");

      await expectStatus(studentJar, "/api/teacher/availability", 403, {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          slots: [{ dayOfWeek: 1, startMinute: 10 * 60, endMinute: 11 * 60 }],
        }),
      });
    }),
  );

  results.push(
    await runStory("US-08", "Materials upload is restricted to assigned teacher/admin", async () => {
      const ownTitle = `Lesson notes ${randomToken()}`;
      const ownMaterial = await uploadMaterial(teacherJar, primaryClass.id, ownTitle);
      assert(ownMaterial?.id, "Expected teacher material create id");

      const listOwn = await expectOkJson(teacherJar, `/api/classes/${primaryClass.id}/materials`, { headers: { accept: "application/json" } });
      assert(Array.isArray(listOwn.items), "Expected teacher materials list");
      assert(listOwn.items.some((m) => m.title === ownTitle), "Expected uploaded material to appear in list");

      await expectStatus(teacherJar, `/api/classes/${otherTeacherClass.id}/materials`, 403, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ title: "Not allowed", fileUrl: "https://example.com/a.pdf", fileSize: 1000 }),
      });

      const adminTitle = `Admin upload ${randomToken()}`;
      const adminMaterial = await uploadMaterial(adminJar, otherTeacherClass.id, adminTitle);
      assert(adminMaterial?.id, "Expected admin material create id");
    }),
  );

  results.push(
    await runStory("US-09", "Admin can schedule + archive classes; archived classes disappear for students", async () => {
      await runSchedulerBatch(adminJar);

      const record = await expectOkJson(adminJar, `/api/classes/${primaryClass.id}`, { headers: { accept: "application/json" } });
      assert(Array.isArray(record.sessions) && record.sessions.length > 0, "Expected class to have sessions");

      // Admin can call reminder cron (secured by admin session or CRON_SECRET).
      const remindersRes = await fetchWithJar(adminJar, "/api/cron/reminders", { method: "POST", headers: { accept: "application/json" } });
      assert(remindersRes.status === 200, `Expected reminders cron 200, got ${remindersRes.status}`);

      await archiveClass(adminJar, primaryClass.id);

      const classes = await expectOkJson(studentJar, `/api/classes?search=${encodeURIComponent(testToken)}&page=1&limit=10`, {
        headers: { accept: "application/json" },
      });
      assert(!classes.items.some((item) => item.id === primaryClass.id), "Expected archived class to be removed from student catalog");

      await expectStatus(studentJar, `/api/classes/${primaryClass.id}`, 404, { headers: { accept: "application/json" } });
    }),
  );

  results.push(
    await runStory("US-10", "Webinar registration unlocks join link for that student", async () => {
      const webinars = await expectOkJson(studentJar, "/api/webinars", { headers: { accept: "application/json" } });
      let webinar = webinars?.items?.find((item) => item?.registered !== true && item?.meetLink === null);

      if (!webinar) {
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
        webinar =
          webinarsRefresh?.items?.find((item) => item?.title === title) ??
          webinarsRefresh?.items?.find((item) => item?.registered !== true && item?.meetLink === null);
      }

      assert(webinar?.id, "Expected at least one webinar");
      assert(webinar.meetLink === null, "Expected webinar meet link hidden before registration");

      await expectOkJson(studentJar, `/api/webinars/${webinar.id}/register`, { method: "POST", headers: { accept: "application/json" } });
      const webinarsAfter = await expectOkJson(studentJar, "/api/webinars", { headers: { accept: "application/json" } });
      const updated = webinarsAfter.items.find((w) => w.id === webinar.id);
      assert(updated?.registered === true, "Expected webinar registered flag");
      assert(typeof updated?.meetLink === "string" && updated.meetLink.length > 0, "Expected webinar meet link after registration");
    }),
  );

  try {
    await archiveClass(adminJar, otherTeacherClass.id);
  } catch {
    // Best-effort cleanup
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} story test(s) failed.`);
    process.exitCode = 1;
    return;
  }

  console.log("All story tests passed.");
}

main().catch((error) => {
  console.error("Story tests failed:", error?.stack ?? error);
  process.exitCode = 1;
});
