/**
 * Integration tests for notification delivery reliability, against a REAL
 * Postgres with every external transport mocked.
 *
 *  - A failed email must fail the job. The platform fallback always reported
 *    SENT, so with a revoked Gmail App Password (535 on every send) every job
 *    was marked COMPLETED while nothing went out.
 *  - A user with no usable channel is NOT a failure: they get an in-app notice
 *    (a real Notification row now) and the job completes.
 *  - The circuit breaker must not trip on recipients who simply have no target
 *    or a permanent per-recipient error; it used to block Telegram for everyone
 *    after five students without a linked chat.
 *
 * Run: DATABASE_URL=postgresql://... RUN_DB_TESTS=1 npx vitest run tests/integration
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

type MailOptions = { to?: string; subject?: string; text?: string };
const sendMail = vi.fn(async (_options: MailOptions) => ({ messageId: "test-id" }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

// One attempt per channel: the real backoff (1 s + 2 s) only slows the test.
vi.mock("@/lib/retry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/retry")>();
  return { ...actual, retryWithBackoff: <T,>(operation: () => Promise<T>) => operation() };
});

const sendWebPush = vi.fn(async () => "Web Push sent (201)");
vi.mock("@/lib/integrations/web-push", () => ({
  isWebPushConfigured: () => true,
  sendWebPush,
}));

const { prisma } = await import("@/lib/prisma");
const { NonRetryableError } = await import("@/lib/retry");
const { deliverWithFallback, landedOnRealChannel } = await import("@/lib/integrations/notifications");
const { deliverOrThrow } = await import("@/lib/jobs/handlers/notifications");
const { enqueue } = await import("@/lib/jobs/queue");
const { drainOnce } = await import("@/lib/jobs/worker");
const { registerAllHandlers } = await import("@/lib/jobs/handlers");

const shouldRun = process.env.RUN_DB_TESTS === "1";
const d = shouldRun ? describe : describe.skip;
const TAG = "ntfdelivery";
const email = (s: string) => `${TAG}+${s}@example.com`;

const EMAIL_ONLY = JSON.stringify({ telegram: false, webPush: false, email: true });
const NOTHING = JSON.stringify({ telegram: false, webPush: false, email: false });

async function cleanup() {
  await prisma.job.deleteMany({});
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${TAG}+` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

async function makeUser(slug: string, over: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: { name: `${TAG} ${slug}`, email: email(slug), role: "STUDENT", approvedAt: new Date(), ...over },
    select: { id: true, email: true },
  });
}

d("notification delivery reliability", () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    await cleanup();
    sendMail.mockReset();
    sendMail.mockImplementation(async () => ({ messageId: "test-id" }));
    sendWebPush.mockReset();
    sendWebPush.mockImplementation(async () => "Web Push sent (201)");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.SMTP_USER = "sender@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.TELEGRAM_BOT_TOKEN;
    await cleanup();
  });

  // ── N1: a failed email must not be reported as delivered ────────────────
  it("throws when email fails with SMTP 535, and stores no in-app notice", async () => {
    const user = await makeUser("smtp535", { notificationPrefs: EMAIL_ONLY });
    sendMail.mockRejectedValue(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"));

    await expect(
      deliverOrThrow({ userId: user.id, email: user.email, notificationPrefs: EMAIL_ONLY }, "hello"),
    ).rejects.toThrow(/535/);

    // The job will be retried, so no notice yet (one per attempt would stack).
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0);
  });

  it("a queued notification whose email fails is retried, not COMPLETED", async () => {
    registerAllHandlers();
    const user = await makeUser("job535");
    sendMail.mockRejectedValue(new Error("Invalid login: 535"));

    const { id } = await enqueue("send_notification", { userId: user.id, email: user.email, content: "Welcome" });
    const result = await drainOnce({ workerId: "t", batchSize: 5 });

    expect(result.retried).toBe(1);
    const job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("FAILED");
    expect(job.lastError).toContain("535");
  });

  it("a successful email completes and stores no platform fallback", async () => {
    const user = await makeUser("ok", { notificationPrefs: EMAIL_ONLY });
    await deliverOrThrow({ userId: user.id, email: user.email, notificationPrefs: EMAIL_ONLY }, "hello");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0);
  });

  it("a user with no usable channel gets a stored in-app notice and no throw", async () => {
    const user = await makeUser("optout", { notificationPrefs: NOTHING });

    await deliverOrThrow({ userId: user.id, email: user.email, notificationPrefs: NOTHING }, "You are enrolled");

    const rows = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.channel).toBe("PLATFORM");
    expect(rows[0]!.content).toBe("You are enrolled");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("deliverWithFallback still ends on PLATFORM SENT for existing callers, but not as a real landing", async () => {
    sendMail.mockRejectedValue(new Error("Invalid login: 535"));
    const deliveries = await deliverWithFallback(
      { userId: "nobody", email: "x@example.com", notificationPrefs: EMAIL_ONLY },
      "hello",
    );
    expect(deliveries.at(-1)).toMatchObject({ channel: "PLATFORM", status: "SENT" });
    expect(deliveries.find((d) => d.channel === "EMAIL")).toMatchObject({ status: "FAILED", retryable: true });
    expect(landedOnRealChannel(deliveries)).toBe(false);
  });

  // ── N2: the breaker must not trip on recipients with nothing to send to ──
  it("skips Telegram for users without a chat id, so it never trips the breaker", async () => {
    // Six students without Telegram: previously each counted as a Telegram
    // failure, and the fifth opened the breaker for everyone for 5 minutes.
    for (let i = 0; i < 6; i += 1) {
      const deliveries = await deliverWithFallback(
        { userId: `no-tg-${i}`, email: "x@example.com", notificationPrefs: JSON.stringify({ webPush: false }) },
        "hi",
      );
      expect(deliveries.some((d) => d.channel === "TELEGRAM")).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();

    // A student WITH Telegram is still reached on Telegram.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 }),
    );
    const deliveries = await deliverWithFallback({ userId: "tg", telegramChatId: "123", email: "x@example.com" }, "hi");
    expect(deliveries[0]).toMatchObject({ channel: "TELEGRAM", status: "SENT" });
  });

  it("does not count non-retryable per-recipient errors toward the breaker", async () => {
    sendWebPush.mockRejectedValue(new NonRetryableError("Push subscription expired (410)"));
    const prefs = JSON.stringify({ telegram: false, email: false });
    for (let i = 0; i < 6; i += 1) {
      await deliverWithFallback({ userId: `dead-${i}`, pushSubscription: "{}", notificationPrefs: prefs }, "hi");
    }
    expect(sendWebPush).toHaveBeenCalledTimes(6);

    // Breaker still closed: the next user's push is actually attempted.
    sendWebPush.mockResolvedValue("Web Push sent (201)");
    const deliveries = await deliverWithFallback({ userId: "live", pushSubscription: "{}", notificationPrefs: prefs }, "hi");
    expect(deliveries[0]).toMatchObject({ channel: "WEB_PUSH", status: "SENT" });
  });

  it("a telegram 403 (bot blocked) is non-retryable and so does not fail the job", async () => {
    const user = await makeUser("blocked", { telegramChatId: "999", notificationPrefs: JSON.stringify({ webPush: false, email: false }) });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked by the user" }), { status: 403 }),
    );
    await expect(
      deliverOrThrow(
        { userId: user.id, telegramChatId: "999", notificationPrefs: JSON.stringify({ webPush: false, email: false }) },
        "hi",
      ),
    ).resolves.toBeUndefined();
    // Nothing real can reach them, so they get the in-app notice instead.
    expect(await prisma.notification.count({ where: { userId: user.id, channel: "PLATFORM" } })).toBe(1);
  });

  // Last on purpose: it leaves the web-push breaker open for this module.
  it("still opens the breaker on genuine transient failures", async () => {
    sendWebPush.mockRejectedValue(new Error("ECONNRESET"));
    const prefs = JSON.stringify({ telegram: false, email: false });
    for (let i = 0; i < 5; i += 1) {
      await deliverWithFallback({ userId: `t-${i}`, pushSubscription: "{}", notificationPrefs: prefs }, "hi");
    }
    expect(sendWebPush).toHaveBeenCalledTimes(5);
    const deliveries = await deliverWithFallback({ userId: "t-6", pushSubscription: "{}", notificationPrefs: prefs }, "hi");
    expect(sendWebPush).toHaveBeenCalledTimes(5);
    expect(deliveries[0]).toMatchObject({ channel: "WEB_PUSH", status: "FAILED", retryable: true });
    expect(deliveries[0]!.detail).toContain("circuit breaker open");
  });
});
