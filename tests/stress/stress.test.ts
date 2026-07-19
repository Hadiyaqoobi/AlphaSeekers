/**
 * Stress / concurrency / scale tests against a REAL Postgres.
 *
 * These are NOT a substitute for load-testing the deployed HTTP service on real
 * infra (see the capacity analysis for that). They validate the correctness
 * properties that must hold under concurrency, and give indicative performance
 * numbers for the data layer at target volume (10k students).
 *
 * Run: DATABASE_URL=postgresql://...?connection_limit=25 RUN_STRESS=1 \
 *      ALPHASEEKERS_MODE=production npx vitest run tests/stress --no-file-parallelism
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { enqueue, queueStats } from "@/lib/jobs/queue";
import { drainOnce, registerHandler } from "@/lib/jobs/worker";
import { enrollStudentInClass } from "@/lib/platform/db-store";
import { getSuperKpis } from "@/lib/platform/super-store";
import { createEmployee, countActiveSuperAdmins, setEmployeeDeactivated } from "@/lib/platform/super-store";
import { sessionReminder } from "@/lib/jobs/handlers/notifications";

const shouldRun = process.env.RUN_STRESS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "stress";
const ms = (t: number) => `${t.toFixed(0)}ms`;

// --- double-processing detector for the queue stress test ---
const processedIds = new Set<string>();
let doubleProcessed = 0;
registerHandler("stress_noop", async (_payload, ctx) => {
  if (processedIds.has(ctx.jobId)) doubleProcessed += 1;
  processedIds.add(ctx.jobId);
});

async function wipe() {
  await prisma.job.deleteMany({});
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}-` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const classes = await prisma.class.findMany({ where: { name: { startsWith: `${TAG}-` } }, select: { id: true } });
  const classIds = classes.map((c) => c.id);
  if (classIds.length) {
    await prisma.attendance.deleteMany({ where: { session: { classId: { in: classIds } } } });
    await prisma.session.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.enrollment.deleteMany({ where: { classId: { in: classIds } } });
  }
  if (ids.length) {
    await prisma.aIInteraction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
  }
  if (classIds.length) await prisma.class.deleteMany({ where: { id: { in: classIds } } });
  if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

d("STRESS", () => {
  afterAll(async () => {
    await wipe();
    await prisma.$disconnect();
  });

  it("queue: 2000 jobs, 16 concurrent workers → each processed exactly once", { timeout: 120_000 }, async () => {
    await prisma.job.deleteMany({});
    processedIds.clear();
    doubleProcessed = 0;

    const N = 2000;
    const rows = Array.from({ length: N }, () => ({ type: "stress_noop", payload: {} }));
    for (let i = 0; i < rows.length; i += 500) {
      await prisma.job.createMany({ data: rows.slice(i, i + 500) });
    }

    const started = Date.now();
    const WORKERS = 16;
    await Promise.all(
      Array.from({ length: WORKERS }, (_, w) =>
        (async () => {
          // Each "worker" drains until the queue is empty.
          for (;;) {
            const r = await drainOnce({ workerId: `w${w}`, batchSize: 20 });
            if (r.processed === 0) break;
          }
        })(),
      ),
    );
    const elapsed = Date.now() - started;

    const stats = await queueStats();
    const throughput = (N / elapsed) * 1000;
    console.log(`\n[queue] ${N} jobs / ${WORKERS} workers in ${ms(elapsed)} → ${throughput.toFixed(0)} jobs/s; doubleProcessed=${doubleProcessed}`);

    expect(doubleProcessed).toBe(0); // SKIP LOCKED must hand each job to exactly one worker
    expect(processedIds.size).toBe(N); // none lost
    expect(stats.COMPLETED).toBe(N);
    expect(stats.PENDING + stats.ACTIVE).toBe(0);
  });

  it("queue: 500 concurrent enqueues with the same dedupeKey → exactly 1 job", { timeout: 60_000 }, async () => {
    await prisma.job.deleteMany({});
    const results = await Promise.allSettled(
      Array.from({ length: 500 }, () => enqueue("stress_noop", {}, { dedupeKey: "stress-unique" })),
    );
    const created = await prisma.job.count({ where: { dedupeKey: "stress-unique" } });
    console.log(`\n[dedupe] 500 concurrent enqueues → ${created} row(s); settled=${results.filter((r) => r.status === "fulfilled").length}`);
    expect(created).toBe(1);
  });

  it("enrollment: 120 concurrent students vs maxStudents=25 → no oversell", { timeout: 120_000 }, async () => {
    const teacher = await prisma.user.create({ data: { name: "T", email: `${TAG}-teacher@x.com`, role: "TEACHER" } });
    const klass = await prisma.class.create({
      data: { name: `${TAG}-cap`, subjectCategory: "math", description: "x", teacherId: teacher.id, maxStudents: 25, status: "ACTIVE" },
    });
    const students = await Promise.all(
      Array.from({ length: 120 }, (_, i) =>
        prisma.user.create({ data: { name: `S${i}`, email: `${TAG}-s${i}@x.com`, role: "STUDENT", approvedAt: new Date() } }),
      ),
    );

    const started = Date.now();
    const outcomes = await Promise.allSettled(students.map((s) => enrollStudentInClass(s.id, klass.id)));
    const elapsed = Date.now() - started;

    const enrolledOk = outcomes.filter((o) => o.status === "fulfilled").length;
    const full = outcomes.filter((o) => o.status === "rejected" && /full/i.test(String((o as PromiseRejectedResult).reason?.message))).length;
    const activeInDb = await prisma.enrollment.count({ where: { classId: klass.id, status: "ACTIVE" } });
    console.log(`\n[enroll] 120 concurrent vs cap 25 in ${ms(elapsed)} → active=${activeInDb}, ok=${enrolledOk}, rejected-full=${full}`);

    expect(activeInDb).toBe(25); // hard invariant: never oversell
    expect(activeInDb).toBeLessThanOrEqual(25);
  });

  it("super-admin guard: concurrent deactivation of all supers never reaches zero", { timeout: 120_000 }, async () => {
    const supers = [];
    for (let i = 0; i < 6; i++) {
      const r = await createEmployee({ name: `Root${i}`, email: `${TAG}-super${i}@x.com`, accessLevel: "SUPER_ADMIN", createdById: "seed" });
      if (r.ok) supers.push(r.employee.id);
    }
    expect(await countActiveSuperAdmins()).toBe(6);

    const results = await Promise.allSettled(supers.map((id) => setEmployeeDeactivated(id, true)));
    const remaining = await countActiveSuperAdmins();
    const okDeactivations = results.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length;
    console.log(`\n[super-guard] 6 supers, concurrent deactivate → remaining active=${remaining}, succeeded=${okDeactivations}`);

    expect(remaining).toBeGreaterThanOrEqual(1); // critical: platform can never be locked out
  });

  it("reminder fan-out: session_reminder to a 200-student class completes", { timeout: 120_000 }, async () => {
    const teacher = await prisma.user.create({ data: { name: "T", email: `${TAG}-rt@x.com`, role: "TEACHER" } });
    const klass = await prisma.class.create({
      data: { name: `${TAG}-fanout`, subjectCategory: "x", description: "x", teacherId: teacher.id, maxStudents: 500, status: "ACTIVE" },
    });
    const students = [];
    for (let i = 0; i < 200; i++) students.push({ name: `F${i}`, email: `${TAG}-f${i}@x.com`, role: "STUDENT" as const, approvedAt: new Date() });
    await prisma.user.createMany({ data: students });
    const created = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}-f` } }, select: { id: true } });
    await prisma.enrollment.createMany({ data: created.map((s) => ({ studentId: s.id, classId: klass.id, status: "ACTIVE" as const })) });
    const session = await prisma.session.create({
      data: { classId: klass.id, startTime: new Date(Date.now() + 3600_000), endTime: new Date(Date.now() + 7200_000) },
    });

    const started = Date.now();
    await sessionReminder({ sessionId: session.id });
    const elapsed = Date.now() - started;
    console.log(`\n[fanout] session_reminder to 200 students in ${ms(elapsed)} (${((200 / elapsed) * 1000).toFixed(0)} deliveries/s, bounded concurrency)`);
    expect(elapsed).toBeGreaterThan(0);
  });

  describe("KPI dashboard at 10k-student volume", () => {
    beforeAll(async () => {
      await wipe();
      const seedStarted = Date.now();
      // 10,000 students
      const students = Array.from({ length: 10_000 }, (_, i) => ({
        name: `Stu${i}`,
        email: `${TAG}-kpi-s${i}@x.com`,
        role: "STUDENT" as const,
        approvedAt: i % 5 === 0 ? null : new Date(), // ~20% pending approval
        createdAt: new Date(Date.now() - (i % 60) * 24 * 60 * 60 * 1000), // spread over 60 days
      }));
      for (let i = 0; i < students.length; i += 2000) await prisma.user.createMany({ data: students.slice(i, i + 2000) });

      const teacher = await prisma.user.create({ data: { name: "KT", email: `${TAG}-kpi-teacher@x.com`, role: "TEACHER" } });
      const classes = Array.from({ length: 60 }, (_, i) => ({
        name: `${TAG}-kpi-c${i}`, subjectCategory: "x", description: "x", teacherId: teacher.id, maxStudents: 300, status: "ACTIVE" as const,
      }));
      await prisma.class.createMany({ data: classes });
      const classRows = await prisma.class.findMany({ where: { name: { startsWith: `${TAG}-kpi-c` } }, select: { id: true } });
      const studentRows = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}-kpi-s` } }, select: { id: true }, take: 10_000 });

      // ~600 sessions (10 per class), half upcoming
      const sessions = classRows.flatMap((c, ci) =>
        Array.from({ length: 10 }, (_, si) => ({
          classId: c.id,
          startTime: new Date(Date.now() + (si - 5) * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (si - 5) * 24 * 60 * 60 * 1000 + 3600_000),
          cancelled: false,
        })).map((s) => ({ ...s, _ci: ci })),
      ).map(({ _ci, ...s }) => s);
      for (let i = 0; i < sessions.length; i += 2000) await prisma.session.createMany({ data: sessions.slice(i, i + 2000) });

      // ~15,000 enrollments (each student in ~1-2 classes)
      const enrollments = studentRows.flatMap((s, i) => {
        const c1 = classRows[i % classRows.length]!.id;
        const list = [{ studentId: s.id, classId: c1, status: "ACTIVE" as const }];
        if (i % 2 === 0) list.push({ studentId: s.id, classId: classRows[(i + 1) % classRows.length]!.id, status: "ACTIVE" as const });
        return list;
      });
      for (let i = 0; i < enrollments.length; i += 2000) await prisma.enrollment.createMany({ data: enrollments.slice(i, i + 2000), skipDuplicates: true });

      // ~20,000 AI interactions across last 30 days, mixed providers
      const providers = ["groq", "gemma", "cache"];
      const ai = Array.from({ length: 20_000 }, (_, i) => ({
        userId: studentRows[i % studentRows.length]!.id,
        query: "q",
        provider: providers[i % 3],
        responseMs: 80 + (i % 400),
        createdAt: new Date(Date.now() - (i % 30) * 24 * 60 * 60 * 1000),
      }));
      for (let i = 0; i < ai.length; i += 2000) await prisma.aIInteraction.createMany({ data: ai.slice(i, i + 2000) });

      // notifications with mixed statuses
      const notifs = Array.from({ length: 3000 }, (_, i) => ({
        userId: studentRows[i % studentRows.length]!.id,
        channel: "EMAIL" as const,
        content: "x",
        status: (i % 10 === 0 ? "FAILED" : i % 7 === 0 ? "PENDING" : "SENT") as "SENT" | "FAILED" | "PENDING",
      }));
      for (let i = 0; i < notifs.length; i += 2000) await prisma.notification.createMany({ data: notifs.slice(i, i + 2000) });

      console.log(`\n[kpi-seed] 10k students + 60 classes + ~600 sessions + ~15k enrollments + 20k AI + 3k notifs in ${ms(Date.now() - seedStarted)}`);
    }, 300_000);

    afterAll(wipe);

    it("getSuperKpis() stays responsive over the full dataset", { timeout: 120_000 }, async () => {
      const runs: number[] = [];
      let kpis;
      for (let i = 0; i < 3; i++) {
        const t = Date.now();
        kpis = await getSuperKpis();
        runs.push(Date.now() - t);
      }
      console.log(`[kpi] getSuperKpis over 10k students: runs=[${runs.map((r) => ms(r)).join(", ")}] students.total=${kpis!.students.total} ai.total=${kpis!.ai.totalInteractions} upcoming=${kpis!.classes.upcomingSessions}`);

      expect(kpis!.students.total).toBeGreaterThanOrEqual(10_000);
      expect(kpis!.ai.totalInteractions).toBeGreaterThanOrEqual(20_000);
      // Catch pathological blowups; the real number is logged above for the report.
      expect(Math.min(...runs)).toBeLessThan(15_000);
    });
  });
});
