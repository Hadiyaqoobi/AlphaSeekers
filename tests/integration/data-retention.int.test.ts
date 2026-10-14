/**
 * Retention for the tables that used to grow forever: rate-limit buckets,
 * password-reset tokens, notifications, scheduler runs, expired cached answers
 * and AI conversation memory. Each case seeds one row past its window and one
 * inside it, then checks only the old one is removed.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { enforceRetentionPolicies } from "@/lib/ai/privacy/data-retention";
import { prisma } from "@/lib/prisma";

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "retentiontest";
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

async function cleanup() {
  await prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: TAG } } });
  await prisma.cachedResponse.deleteMany({ where: { questionHash: { startsWith: TAG } } });
  await prisma.aIConversation.deleteMany({ where: { sessionId: { startsWith: TAG } } });
  await prisma.schedulerJob.deleteMany({ where: { totalCount: 4242 } });
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.passwordReset.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

d("data retention", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("deletes only rows past their retention window and reports the counts", async () => {
    const user = await prisma.user.create({
      data: { name: TAG, email: `${TAG}+u@example.com`, role: "STUDENT" },
      select: { id: true },
    });

    await prisma.rateLimitBucket.createMany({
      data: [
        { key: `${TAG}:old`, count: 3, resetAt: ago(2) },
        { key: `${TAG}:fresh`, count: 3, resetAt: ago(0.5) },
      ],
    });
    await prisma.passwordReset.createMany({
      data: [
        { userId: user.id, tokenHash: `${TAG}-old`, expiresAt: ago(8) },
        { userId: user.id, tokenHash: `${TAG}-fresh`, expiresAt: ago(1) },
      ],
    });
    await prisma.notification.createMany({
      data: [
        { userId: user.id, channel: "EMAIL", content: "old", status: "SENT", createdAt: ago(91) },
        { userId: user.id, channel: "EMAIL", content: "fresh", status: "SENT", createdAt: ago(10) },
      ],
    });
    const oldDone = await prisma.schedulerJob.create({
      data: { status: "COMPLETED", totalCount: 4242, createdAt: ago(40), updatedAt: ago(31) },
    });
    const oldRunning = await prisma.schedulerJob.create({
      data: { status: "RUNNING", totalCount: 4242, createdAt: ago(40), updatedAt: ago(31) },
    });
    const freshDone = await prisma.schedulerJob.create({
      data: { status: "COMPLETED", totalCount: 4242, updatedAt: ago(2) },
    });
    await prisma.cachedResponse.createMany({
      data: [
        { questionHash: `${TAG}-expired`, questionText: "q", answer: "a", provider: "t", expiresAt: ago(1) },
        { questionHash: `${TAG}-live`, questionText: "q", answer: "a", provider: "t", expiresAt: new Date(Date.now() + DAY) },
        { questionHash: `${TAG}-forever`, questionText: "q", answer: "a", provider: "t", expiresAt: null },
      ],
    });
    await prisma.aIConversation.createMany({
      data: [
        { userId: user.id, sessionId: `${TAG}-old`, messages: [], createdAt: ago(120), updatedAt: ago(91) },
        // Started long ago but still in use: kept.
        { userId: user.id, sessionId: `${TAG}-active`, messages: [], createdAt: ago(120), updatedAt: ago(3) },
      ],
    });

    const result = await enforceRetentionPolicies();

    expect(result.rateLimitBucketsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.passwordResetsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.notificationsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.schedulerJobsDeleted).toBeGreaterThanOrEqual(1);
    expect(result.cachedResponsesDeleted).toBeGreaterThanOrEqual(1);
    expect(result.conversationsDeleted).toBeGreaterThanOrEqual(1);
    // The pre-existing counters are still reported.
    expect(typeof result.interactionsDeleted).toBe("number");

    const buckets = await prisma.rateLimitBucket.findMany({ where: { key: { startsWith: TAG } }, select: { key: true } });
    expect(buckets.map((b) => b.key)).toEqual([`${TAG}:fresh`]);

    const resets = await prisma.passwordReset.findMany({ where: { userId: user.id }, select: { tokenHash: true } });
    expect(resets.map((r) => r.tokenHash)).toEqual([`${TAG}-fresh`]);

    const notes = await prisma.notification.findMany({ where: { userId: user.id }, select: { content: true } });
    expect(notes.map((n) => n.content)).toEqual(["fresh"]);

    const runs = await prisma.schedulerJob.findMany({ where: { totalCount: 4242 }, select: { id: true } });
    const runIds = runs.map((r) => r.id).sort();
    expect(runIds).toEqual([oldRunning.id, freshDone.id].sort());
    expect(runIds).not.toContain(oldDone.id);

    const cached = await prisma.cachedResponse.findMany({ where: { questionHash: { startsWith: TAG } }, select: { questionHash: true } });
    expect(cached.map((c) => c.questionHash).sort()).toEqual([`${TAG}-forever`, `${TAG}-live`]);

    const conversations = await prisma.aIConversation.findMany({ where: { userId: user.id }, select: { sessionId: true } });
    expect(conversations.map((c) => c.sessionId)).toEqual([`${TAG}-active`]);
  });
});
