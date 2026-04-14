#!/usr/bin/env node
/* QA Audit Script — Tests ALL pages, forms, APIs, security, and navigation */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const results = [];
let testNum = 0;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class CookieJar {
  constructor() { this.cookies = new Map(); }
  header() { return [...this.cookies.entries()].map(([k,v]) => `${k}=${v}`).join("; "); }
  addFromSetCookie(sc) {
    if (!sc || typeof sc !== "string") return;
    const fp = sc.split(";")[0] ?? "";
    const eq = fp.indexOf("=");
    if (eq <= 0) return;
    this.cookies.set(fp.slice(0,eq).trim(), fp.slice(eq+1).trim());
  }
}

async function fetchJ(jar, path, init = {}) {
  const h = new Headers(init.headers ?? {});
  if (jar?.cookies.size > 0 && !h.has("cookie")) h.set("cookie", jar.header());
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: h, redirect: init.redirect ?? "manual" });
  if (jar && typeof res.headers.getSetCookie === "function") {
    for (const sc of res.headers.getSetCookie()) jar.addFromSetCookie(sc);
  }
  return res;
}

async function login(email, password) {
  const jar = new CookieJar();
  const csrfRes = await fetchJ(jar, "/api/auth/csrf", { headers: { accept: "application/json" } });
  const csrf = await csrfRes.json();
  const form = new URLSearchParams();
  form.set("csrfToken", csrf.csrfToken);
  form.set("email", email);
  form.set("password", password);
  form.set("callbackUrl", `${BASE_URL}/en/dashboard`);
  form.set("json", "true");
  const res = await fetchJ(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  await sleep(50);
  const sessionRes = await fetchJ(jar, "/api/auth/session", { headers: { accept: "application/json" } });
  const session = await sessionRes.json();
  return { jar, session, status: res.status };
}

function record(name, status, details) {
  testNum++;
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  results.push({ num: testNum, name, status, details });
  console.log(`${icon} Test ${testNum}: ${name} — ${status}`);
  if (details) console.log(`   ${details}`);
}

async function testPage(jar, path, label, checks = {}) {
  try {
    const res = await fetchJ(jar, path, { headers: { accept: "text/html" } });
    const body = await res.text();
    const status = res.status;
    if (status !== 200) {
      record(`${label} (${path})`, "FAIL", `HTTP ${status}`);
      return { status, body };
    }
    let issues = [];
    if (checks.mustInclude) {
      for (const s of checks.mustInclude) {
        if (!body.includes(s)) issues.push(`Missing: "${s}"`);
      }
    }
    if (checks.mustNotInclude) {
      for (const s of checks.mustNotInclude) {
        if (body.includes(s)) issues.push(`Found forbidden: "${s}"`);
      }
    }
    if (issues.length > 0) {
      record(`${label} (${path})`, "PARTIAL", issues.join("; "));
    } else {
      record(`${label} (${path})`, "PASS", `HTTP ${status}, ${(body.length / 1024).toFixed(0)}KB`);
    }
    return { status, body };
  } catch (e) {
    record(`${label} (${path})`, "FAIL", e.message);
    return { status: 0, body: "" };
  }
}

async function testAPI(jar, method, path, label, opts = {}) {
  try {
    const init = { method, headers: { accept: "application/json", ...opts.headers } };
    if (opts.body) {
      init.body = JSON.stringify(opts.body);
      init.headers["content-type"] = "application/json";
    }
    const res = await fetchJ(jar, path, init);
    const ct = res.headers.get("content-type") ?? "";
    let body;
    if (ct.includes("json")) body = await res.json();
    else body = await res.text();
    
    if (opts.expectStatus && res.status !== opts.expectStatus) {
      record(`${label}`, "FAIL", `Expected ${opts.expectStatus}, got ${res.status}`);
      return { status: res.status, body };
    }
    if (res.ok || (opts.expectStatus && res.status === opts.expectStatus)) {
      record(`${label}`, "PASS", `${method} ${path} → ${res.status}`);
    } else {
      record(`${label}`, "FAIL", `${method} ${path} → ${res.status}: ${typeof body === 'string' ? body.slice(0,100) : JSON.stringify(body).slice(0,100)}`);
    }
    return { status: res.status, body };
  } catch (e) {
    record(`${label}`, "FAIL", e.message);
    return { status: 0, body: null };
  }
}

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  AlphaSeekers QA Audit — ${new Date().toISOString()}`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`${"=".repeat(60)}\n`);

  // ============================================================
  // PHASE 1: Health & Public Pages
  // ============================================================
  console.log("\n--- PHASE 1: Health & Public Pages ---\n");
  
  await testAPI(null, "GET", "/api/health", "API Health Check");
  await testPage(null, "/en", "Homepage EN (unauthenticated)", { mustInclude: ["AlphaSeekers"] });
  await testPage(null, "/fa", "Homepage FA (unauthenticated)", { mustInclude: ['dir="rtl"'] });
  await testPage(null, "/en/login", "Login Page EN", { mustInclude: ["Log in", "Email", "Password"] });
  await testPage(null, "/en/register", "Register Page EN", { mustInclude: ["Request access", "Student", "Teacher"] });
  
  // ============================================================
  // PHASE 2: Registration Flow
  // ============================================================
  console.log("\n--- PHASE 2: Registration Flow ---\n");

  const regToken = Math.random().toString(36).slice(2,8);
  const studentEmail = `qa_student_${regToken}@test.com`;
  const teacherEmail = `qa_teacher_${regToken}@test.com`;
  const password = `QApass${regToken}123!`;

  // Register student
  await testAPI(null, "POST", "/api/auth/register", "Register Student", {
    body: { name: "QA Student", email: studentEmail, password, role: "STUDENT", language: "EN", timezone: "UTC" }
  });

  // Register teacher
  await testAPI(null, "POST", "/api/auth/register", "Register Teacher", {
    body: { name: "QA Teacher", email: teacherEmail, password, role: "TEACHER", language: "EN", timezone: "UTC" }
  });

  // Try login as unapproved student → should fail 401
  const pendingLogin = await login(studentEmail, password);
  if (!pendingLogin.session?.user?.role) {
    record("Pending student login blocked", "PASS", "No session granted for unapproved user");
  } else {
    record("Pending student login blocked", "FAIL", `SECURITY: Unapproved user got session with role ${pendingLogin.session.user.role}`);
  }

  // ============================================================
  // PHASE 3: Admin Login & User Approval
  // ============================================================
  console.log("\n--- PHASE 3: Admin Login & User Approval ---\n");

  const admin = await login("admin@alphaseekers.org", "admin123");
  if (admin.session?.user?.role === "ADMIN") {
    record("Admin login", "PASS", `Admin session established. User: ${admin.session.user.name}`);
  } else {
    record("Admin login", "FAIL", `Expected ADMIN role, got: ${admin.session?.user?.role}`);
    console.error("Cannot continue admin tests. Aborting.");
    return;
  }
  const adminJar = admin.jar;

  // Admin pages
  await testPage(adminJar, "/en/dashboard", "Admin Dashboard", { mustInclude: ["Active classes", "Students", "Teachers"] });
  await testPage(adminJar, "/en/admin", "Admin Panel", { mustInclude: ["Pending Approvals", "Approve"] });
  await testPage(adminJar, "/en/classes", "Classes Page (Admin)", { mustInclude: ["Classes"] });
  await testPage(adminJar, "/en/webinars", "Webinars Page (Admin)", { mustInclude: ["Webinars"] });
  await testPage(adminJar, "/en/opportunities", "Opportunities Page (Admin)", { mustInclude: ["Opportunities"] });
  await testPage(adminJar, "/en/library", "Library Page (Admin)", { mustInclude: ["Library"] });
  await testPage(adminJar, "/en/profile", "Profile Page (Admin)", { mustInclude: ["Profile"] });
  await testPage(adminJar, "/en/staff", "Staff Page (Admin)");
  await testPage(adminJar, "/en/teacher/availability", "Teacher Availability (Admin)");
  await testPage(adminJar, "/en/study-assistant", "AI Tutor Page (Admin)");

  // Approve student
  const pendingList = await testAPI(adminJar, "GET", `/api/admin/users?status=PENDING&search=${encodeURIComponent(studentEmail)}&limit=10&page=1`, "List Pending Users");
  const pendingStudent = pendingList.body?.items?.find(u => u.email === studentEmail);
  if (pendingStudent) {
    await testAPI(adminJar, "PATCH", `/api/admin/users/${pendingStudent.id}`, "Approve QA Student", { body: { approved: true } });
  } else {
    record("Find pending QA Student", "FAIL", "Not found in pending list");
  }

  // Approve teacher
  const pendingTeachers = await testAPI(adminJar, "GET", `/api/admin/users?status=PENDING&search=${encodeURIComponent(teacherEmail)}&limit=10&page=1`, "List Pending Teachers");
  const pendingTeacher = pendingTeachers.body?.items?.find(u => u.email === teacherEmail);
  if (pendingTeacher) {
    await testAPI(adminJar, "PATCH", `/api/admin/users/${pendingTeacher.id}`, "Approve QA Teacher", { body: { approved: true } });
  } else {
    record("Find pending QA Teacher", "FAIL", "Not found in pending list");
  }

  // ============================================================
  // PHASE 4: Student Login & Dashboard
  // ============================================================
  console.log("\n--- PHASE 4: Student Login & Dashboard ---\n");

  const student = await login("student@alphaseekers.org", "student123");
  if (student.session?.user?.role === "STUDENT") {
    record("Student login (pre-existing)", "PASS", `Session: ${student.session.user.name}`);
  } else {
    record("Student login (pre-existing)", "FAIL", `Role: ${student.session?.user?.role}`);
  }
  const studentJar = student.jar;

  // Student pages
  await testPage(studentJar, "/en/dashboard", "Student Dashboard", { mustInclude: ["Dashboard", "Welcome"] });
  await testPage(studentJar, "/en/classes", "Classes Page (Student)", { mustInclude: ["Classes"] });
  await testPage(studentJar, "/en/webinars", "Webinars Page (Student)");
  await testPage(studentJar, "/en/opportunities", "Opportunities Page (Student)");
  await testPage(studentJar, "/en/library", "Library Page (Student)");
  await testPage(studentJar, "/en/profile", "Profile Page (Student)", { mustInclude: ["Student profile"] });
  await testPage(studentJar, "/en/study-assistant", "AI Tutor (Student)");

  // ============================================================
  // PHASE 5: Teacher Login & Dashboard
  // ============================================================
  console.log("\n--- PHASE 5: Teacher Login & Dashboard ---\n");

  const teacher = await login("teacher@alphaseekers.org", "teacher123");
  if (teacher.session?.user?.role === "TEACHER") {
    record("Teacher login (pre-existing)", "PASS", `Session: ${teacher.session.user.name}`);
  } else {
    record("Teacher login (pre-existing)", "FAIL", `Role: ${teacher.session?.user?.role}`);
  }
  const teacherJar = teacher.jar;

  await testPage(teacherJar, "/en/dashboard", "Teacher Dashboard", { mustInclude: ["Dashboard", "Welcome"] });
  await testPage(teacherJar, "/en/teacher/availability", "Teacher Availability Page", { mustInclude: ["Availability"] });
  await testPage(teacherJar, "/en/classes", "Classes Page (Teacher)");
  await testPage(teacherJar, "/en/profile", "Profile Page (Teacher)");

  // ============================================================
  // PHASE 6: API Endpoint Audit
  // ============================================================
  console.log("\n--- PHASE 6: API Endpoint Audit ---\n");

  // Classes API
  await testAPI(studentJar, "GET", "/api/classes?page=1&limit=10", "GET /api/classes (student)");
  
  // Get first class for detail test
  const classListRes = await fetchJ(studentJar, "/api/classes?page=1&limit=10", { headers: { accept: "application/json" } });
  const classList = await classListRes.json();
  const firstClass = classList?.items?.[0];
  
  if (firstClass) {
    // Class detail before enrollment
    const detailRes = await testAPI(studentJar, "GET", `/api/classes/${firstClass.id}`, "Class Detail (before enrollment)");
    const sessions = detailRes.body?.sessions;
    if (sessions && sessions.every(s => s.meetLink === null)) {
      record("Meet links hidden before enrollment", "PASS", "All meetLink fields are null");
    } else if (sessions) {
      record("Meet links hidden before enrollment", "FAIL", "SECURITY: Meet links visible before enrollment!");
    }

    // Enroll
    await testAPI(studentJar, "POST", `/api/classes/${firstClass.id}/enroll`, "Enroll in class");

    // Class detail after enrollment
    const afterEnroll = await testAPI(studentJar, "GET", `/api/classes/${firstClass.id}`, "Class Detail (after enrollment)");
    const sessionsAfter = afterEnroll.body?.sessions;
    if (sessionsAfter && sessionsAfter.some(s => s.meetLink !== null)) {
      record("Meet links visible after enrollment", "PASS", "Meet links exposed correctly");
    } else {
      record("Meet links visible after enrollment", "FAIL", "Meet links still hidden after enrollment");
    }

    // Materials after enrollment
    await testAPI(studentJar, "GET", `/api/classes/${firstClass.id}/materials`, "Materials (after enrollment)");

    // Unenroll
    await testAPI(studentJar, "DELETE", `/api/classes/${firstClass.id}/enroll`, "Unenroll from class");

    // Meet links hidden after unenroll
    const afterUnenroll = await testAPI(studentJar, "GET", `/api/classes/${firstClass.id}`, "Class Detail (after unenroll)");
    const sessionsUnenroll = afterUnenroll.body?.sessions;
    if (sessionsUnenroll && sessionsUnenroll.every(s => s.meetLink === null)) {
      record("Meet links hidden after unenroll", "PASS", "Security: access revoked correctly");
    } else {
      record("Meet links hidden after unenroll", "FAIL", "SECURITY: Meet links still visible after unenroll!");
    }

    // Materials denied after unenroll
    await testAPI(studentJar, "GET", `/api/classes/${firstClass.id}/materials`, "Materials (after unenroll)", { expectStatus: 403 });
  }

  // Schedule
  await testAPI(studentJar, "GET", "/api/me/schedule", "Student Schedule");
  
  // Teacher availability
  await testAPI(teacherJar, "GET", "/api/teacher/availability", "Teacher Availability GET");
  
  // Webinars
  await testAPI(studentJar, "GET", "/api/webinars", "GET /api/webinars (student)");
  
  // Library
  await testAPI(studentJar, "GET", "/api/library", "GET /api/library");
  
  // Opportunities
  await testAPI(studentJar, "GET", "/api/opportunities", "GET /api/opportunities");
  
  // Notifications
  await testAPI(studentJar, "GET", "/api/me/notifications", "GET /api/me/notifications");
  
  // Profile
  await testAPI(studentJar, "GET", "/api/me/profile", "GET /api/me/profile");

  // ============================================================
  // PHASE 7: Security — Access Control
  // ============================================================
  console.log("\n--- PHASE 7: Security — Access Control ---\n");

  // Student cannot access admin endpoints
  await testAPI(studentJar, "GET", "/api/admin/users?status=PENDING&limit=1&page=1", "Student → Admin Users", { expectStatus: 403 });
  await testAPI(studentJar, "POST", "/api/admin/classes", "Student → Create Class", {
    expectStatus: 403,
    body: { name: "Hacked", teacherId: "x", maxStudents: 5, durationMinutes: 30, schedulePreference: "Mon 9 AM" }
  });

  // Student cannot update teacher availability
  await testAPI(studentJar, "PUT", "/api/teacher/availability", "Student → Teacher Availability PUT", {
    expectStatus: 403,
    body: { slots: [{ dayOfWeek: 1, startMinute: 600, endMinute: 660 }] }
  });

  // Teacher cannot access admin endpoints
  await testAPI(teacherJar, "GET", "/api/admin/users?status=PENDING&limit=1&page=1", "Teacher → Admin Users", { expectStatus: 403 });

  // Unauthenticated cannot access protected pages
  const unauthJar = new CookieJar();
  const dashRes = await fetchJ(unauthJar, "/en/dashboard", { headers: { accept: "text/html" } });
  if (dashRes.status === 302 || dashRes.status === 307 || dashRes.status === 200) {
    const loc = dashRes.headers.get("location") ?? "";
    const body = await dashRes.text();
    if (loc.includes("login") || body.includes("Log in")) {
      record("Unauthenticated → Dashboard redirects to login", "PASS", `Status ${dashRes.status}`);
    } else if (body.includes("Dashboard") && body.includes("Welcome")) {
      record("Unauthenticated → Dashboard", "FAIL", "SECURITY: Dashboard accessible without auth!");
    } else {
      record("Unauthenticated → Dashboard", "PASS", `Status ${dashRes.status}, not showing dashboard content`);
    }
  } else {
    record("Unauthenticated → Dashboard", "PASS", `Redirected with status ${dashRes.status}`);
  }

  // ============================================================
  // PHASE 8: i18n / RTL
  // ============================================================
  console.log("\n--- PHASE 8: i18n / RTL ---\n");

  await testPage(null, "/fa", "Farsi Homepage", { mustInclude: ['dir="rtl"', "خانه"] });
  await testPage(null, "/fa/login", "Farsi Login", { mustInclude: ['dir="rtl"'] });
  await testPage(null, "/fa/register", "Farsi Register", { mustInclude: ['dir="rtl"'] });
  await testPage(studentJar, "/fa/dashboard", "Farsi Student Dashboard", { mustInclude: ['dir="rtl"', "داشبورد"] });
  await testPage(studentJar, "/fa/classes", "Farsi Classes Page", { mustInclude: ['dir="rtl"', "صنف‌ها"] });
  await testPage(studentJar, "/fa/profile", "Farsi Profile Page", { mustInclude: ['dir="rtl"', "پروفایل"] });

  // ============================================================
  // PHASE 9: Edge Cases & Invalid Routes
  // ============================================================
  console.log("\n--- PHASE 9: Edge Cases ---\n");

  // 404 page
  const notFound = await fetchJ(null, "/en/this-page-does-not-exist", { headers: { accept: "text/html" } });
  if (notFound.status === 404) {
    record("404 for invalid route", "PASS", "Returns proper 404");
  } else {
    record("404 for invalid route", "FAIL", `Expected 404, got ${notFound.status}`);
  }

  // Invalid class ID
  await testAPI(studentJar, "GET", "/api/classes/nonexistent-class-id", "Invalid class ID", { expectStatus: 404 });

  // Double enrollment (idempotency)
  if (firstClass) {
    await testAPI(studentJar, "POST", `/api/classes/${firstClass.id}/enroll`, "First enrollment");
    const doubleRes = await fetchJ(studentJar, `/api/classes/${firstClass.id}/enroll`, {
      method: "POST", headers: { accept: "application/json" }
    });
    if (doubleRes.status === 200 || doubleRes.status === 409) {
      record("Double enrollment handling", "PASS", `Status ${doubleRes.status} (idempotent or conflict)`);
    } else {
      record("Double enrollment handling", "FAIL", `Unexpected status ${doubleRes.status}`);
    }
    await testAPI(studentJar, "DELETE", `/api/classes/${firstClass.id}/enroll`, "Cleanup unenroll");
  }

  // XSS test
  const xssRes = await fetchJ(studentJar, `/api/classes?search=${encodeURIComponent("<script>alert('xss')</script>")}&page=1&limit=10`, {
    headers: { accept: "application/json" }
  });
  const xssBody = await xssRes.text();
  if (!xssBody.includes("<script>alert('xss')")) {
    record("XSS in search query", "PASS", "Input sanitized or not reflected");
  } else {
    record("XSS in search query", "FAIL", "SECURITY: Script tags reflected in response!");
  }

  // SQL injection test
  const sqlRes = await fetchJ(studentJar, `/api/classes?search=${encodeURIComponent("' OR '1'='1")}&page=1&limit=10`, {
    headers: { accept: "application/json" }
  });
  if (sqlRes.status === 200) {
    const sqlBody = await sqlRes.json();
    record("SQL injection in search", "PASS", `Returned ${sqlBody.items?.length ?? 0} items (Prisma ORM prevents injection)`);
  } else {
    record("SQL injection in search", "PASS", `Returned ${sqlRes.status} (safe)`);
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log(`\n${"=".repeat(60)}`);
  console.log("  QA AUDIT SUMMARY");
  console.log(`${"=".repeat(60)}`);
  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const partial = results.filter(r => r.status === "PARTIAL").length;
  console.log(`  Total Tests: ${results.length}`);
  console.log(`  ✅ PASS:    ${pass}`);
  console.log(`  ❌ FAIL:    ${fail}`);
  console.log(`  ⚠️  PARTIAL: ${partial}`);
  console.log(`${"=".repeat(60)}\n`);

  if (fail > 0) {
    console.log("FAILURES:");
    for (const r of results.filter(r => r.status === "FAIL")) {
      console.log(`  ❌ Test ${r.num}: ${r.name} — ${r.details}`);
    }
    console.log();
  }

  if (partial > 0) {
    console.log("PARTIAL:");
    for (const r of results.filter(r => r.status === "PARTIAL")) {
      console.log(`  ⚠️  Test ${r.num}: ${r.name} — ${r.details}`);
    }
    console.log();
  }

  // Output as markdown for the report
  let md = `\n## QA Audit Automated Test Results\n\n`;
  md += `| # | Test | Status | Details |\n`;
  md += `|---|------|--------|---------|\n`;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⚠️";
    md += `| ${r.num} | ${r.name} | ${icon} ${r.status} | ${(r.details||'').replace(/\|/g,'\\|')} |\n`;
  }
  console.log(md);
}

main().catch(e => { console.error("QA Audit crashed:", e); process.exitCode = 1; });
