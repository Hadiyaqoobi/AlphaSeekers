/**
 * A push subscription the browser has dropped (404/410 Gone) is dead for good.
 * It used to be retried three times with backoff on every notification and
 * never cleared; now it is non-retryable and removed from the user's row.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}));

const { prisma } = await import("@/lib/prisma");
const { NonRetryableError } = await import("@/lib/retry");
const { sendWebPush } = await import("@/lib/integrations/web-push");

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "pushexpiry";
const SUB = JSON.stringify({ endpoint: "https://push.example/abc", keys: { p256dh: "k", auth: "a" } });

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}+` } } });
}

d("expired push subscriptions", () => {
  beforeEach(async () => {
    await cleanup();
    sendNotification.mockReset();
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
  });
  afterAll(async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    await cleanup();
  });

  it.each([404, 410])("a %i is non-retryable and clears the stored subscription", async (statusCode) => {
    const user = await prisma.user.create({
      data: { name: "p", email: `${TAG}+${statusCode}@example.com`, role: "STUDENT", pushSubscription: SUB },
      select: { id: true },
    });
    sendNotification.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode }));

    const attempt = sendWebPush({ userId: user.id, pushSubscription: SUB }, "hi");
    await expect(attempt).rejects.toBeInstanceOf(NonRetryableError);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { pushSubscription: true } });
    expect(row.pushSubscription).toBeNull();
  });

  it("does not wipe a NEWER subscription saved since the send started", async () => {
    const user = await prisma.user.create({
      data: { name: "p", email: `${TAG}+newer@example.com`, role: "STUDENT", pushSubscription: "newer-subscription" },
      select: { id: true },
    });
    sendNotification.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }));

    await expect(sendWebPush({ userId: user.id, pushSubscription: SUB }, "hi")).rejects.toBeInstanceOf(NonRetryableError);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { pushSubscription: true } });
    expect(row.pushSubscription).toBe("newer-subscription");
  });

  it("other errors stay retryable and leave the subscription alone", async () => {
    const user = await prisma.user.create({
      data: { name: "p", email: `${TAG}+500@example.com`, role: "STUDENT", pushSubscription: SUB },
      select: { id: true },
    });
    sendNotification.mockRejectedValue(Object.assign(new Error("Server error"), { statusCode: 500 }));

    const error = await sendWebPush({ userId: user.id, pushSubscription: SUB }, "hi").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(NonRetryableError);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { pushSubscription: true } });
    expect(row.pushSubscription).toBe(SUB);
  });
});
