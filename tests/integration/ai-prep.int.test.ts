/**
 * Pre-class prep (runAiPrep) against a REAL Postgres: idempotent per student,
 * honours the Telegram preference, states the real minutes-until-start and the
 * start time in Kabul time (not server UTC). Telegram is mocked.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const tg = vi.hoisted(() => ({ sendTelegram: vi.fn(async () => "ok") }));
vi.mock("@/lib/integrations/telegram", () => ({ sendTelegram: tg.sendTelegram }));

import { prisma } from "@/lib/prisma";
import {
  PREP_WINDOW_MAX,
  PREP_WINDOW_MIN,
  buildPrepMessage,
  formatPrepTime,
  parseNotificationPrefs,
  runAiPrep,
  topTopics,
} from "@/lib/ai/session/ai-prep";

describe("ai-prep helpers", () => {
  it("formats the start in Asia/Kabul (UTC+4:30), not server UTC", () => {
    const start = new Date("2026-10-14T06:30:00Z"); // 11:00 in Kabul
    expect(formatPrepTime(start, "EN", null)).toBe("11:00 AM");
    expect(formatPrepTime(start, "EN", "Not/AZone")).toBe("11:00 AM");
    // Dari users get their own locale's digits/format.
    expect(formatPrepTime(start, "FA", null)).toBe(start.toLocaleTimeString("fa-AF", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kabul",
    }));
  });

  it("states the real minutes until start", () => {
    const msg = buildPrepMessage({
      className: "English A2",
      studentName: "Sam Lee",
      minutesUntil: 62.4,
      startLabel: "11:00 AM",
      struggledTopics: [],
      materialTitles: [],
      meetLink: null,
    });
    expect(msg).toContain("starts in 62 minutes (11:00 AM)");
    expect(msg).not.toContain("~30");
  });

  it("parses prefs defensively and ranks topics", () => {
    expect(parseNotificationPrefs('{"telegram":false}')).toEqual({ telegram: false });
    expect(parseNotificationPrefs("not json")).toEqual({});
    expect(topTopics(["a,b", "a", null, "c,a,b"])).toEqual(["a", "b"]);
  });

  it("keeps the window wider than the hourly pulse", () => {
    expect(PREP_WINDOW_MAX - PREP_WINDOW_MIN).toBeGreaterThan(60);
  });
});

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "aiprep";
const email = (s: string) => `${TAG}+${s}@example.com`;

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.aIInteraction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.material.deleteMany({ where: { uploadedBy: { in: ids } } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.session.deleteMany({ where: { class: { teacherId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { teacherId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

d("runAiPrep (real Postgres)", () => {
  beforeEach(async () => {
    await cleanup();
    tg.sendTelegram.mockClear();
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("sends once per student, respects Telegram opt-out, skips deactivated students", async () => {
    const now = new Date("2026-10-14T06:00:00Z");
    const teacher = await prisma.user.create({ data: { name: "T", email: email("t"), role: "TEACHER" } });
    const optedOut = await prisma.user.create({
      data: {
        name: "Ana Opt",
        email: email("s1"),
        role: "STUDENT",
        approvedAt: now,
        language: "EN",
        telegramChatId: "111",
        notificationPrefs: JSON.stringify({ telegram: false, webPush: true, email: true }),
      },
    });
    const optedIn = await prisma.user.create({
      data: { name: "Bo In", email: email("s2"), role: "STUDENT", approvedAt: now, language: "EN", telegramChatId: "222" },
    });
    const gone = await prisma.user.create({
      data: { name: "Gone", email: email("s3"), role: "STUDENT", approvedAt: now, deactivatedAt: now },
    });
    const klass = await prisma.class.create({
      data: { name: "Prep Class", subjectCategory: "languages", description: "x", teacherId: teacher.id, maxStudents: 10 },
    });
    for (const s of [optedOut, optedIn, gone]) {
      await prisma.enrollment.create({ data: { studentId: s.id, classId: klass.id, status: "ACTIVE" } });
    }
    await prisma.session.create({
      data: {
        classId: klass.id,
        startTime: new Date(now.getTime() + 40 * 60 * 1000), // 06:40Z = 11:10 Kabul
        endTime: new Date(now.getTime() + 100 * 60 * 1000),
      },
    });
    await prisma.material.create({
      data: { classId: klass.id, title: "Week 3 reading", fileUrl: "https://x.test/a.pdf", fileSize: 1, uploadedBy: teacher.id },
    });
    await prisma.aIInteraction.create({
      data: { userId: optedIn.id, query: "q", topics: "past tense", rating: "negative", classIds: klass.id, createdAt: now },
    });

    const first = await runAiPrep(now);
    expect(first).toMatchObject({ sessionsProcessed: 1, sent: 2, skipped: 0 });

    // Telegram only for the student who did not opt out.
    expect(tg.sendTelegram).toHaveBeenCalledTimes(1);
    expect(tg.sendTelegram.mock.calls[0][0]).toMatchObject({ userId: optedIn.id, telegramChatId: "222" });

    const notes = await prisma.notification.findMany({ where: { userId: { in: [optedOut.id, optedIn.id, gone.id] } } });
    expect(notes).toHaveLength(2);
    const bo = notes.find((n) => n.userId === optedIn.id)!;
    expect(bo.content).toContain("starts in 40 minutes (11:10 AM)");
    expect(bo.content).toContain("Review: past tense");
    expect(bo.content).toContain("Materials: Week 3 reading");

    // Second run in the same window: nothing new, no second Telegram.
    const second = await runAiPrep(now);
    expect(second).toMatchObject({ sent: 0, skipped: 2 });
    expect(tg.sendTelegram).toHaveBeenCalledTimes(1);
  });
});
