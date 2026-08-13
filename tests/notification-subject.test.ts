/**
 * Unit tests for the email subject on queued notifications.
 *
 * Generic notifications are titled "AlphaSeekers notification", which is fine
 * for a session reminder but wrong for a message the admin team is meant to
 * read and act on — it looks like automated noise in their inbox. A queued job
 * may therefore carry its own subject.
 *
 * nodemailer is mocked so the subject actually handed to sendMail is asserted,
 * rather than trusting that it was plumbed through.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type MailOptions = { to?: string; subject?: string; text?: string };
const sendMail = vi.fn(async (_options: MailOptions) => ({ messageId: "test-id" }));

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}));
const { deliverWithFallback } = await import("@/lib/integrations/notifications");

// Opting out of Telegram and Web Push in the target's own prefs is how the
// fallback chain is meant to be steered — no need to mock those transports, and
// it avoids their retry backoff.
const target = {
  userId: "u1",
  email: "someone@example.com",
  notificationPrefs: JSON.stringify({ telegram: false, webPush: false, email: true }),
};

describe("notification email subject", () => {
  beforeEach(() => {
    sendMail.mockClear();
    process.env.SMTP_USER = "sender@example.com";
    process.env.SMTP_PASS = "secret";
  });

  it("falls back to the generic subject when none is given", async () => {
    await deliverWithFallback(target, "Your class starts in 30 minutes.");

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0]?.[0].subject).toBe("AlphaSeekers notification");
  });

  it("uses a supplied subject", async () => {
    await deliverWithFallback(target, "Please use Support from now on.", {
      subject: "New way to report issues",
    });

    expect(sendMail.mock.calls[0]?.[0].subject).toBe("New way to report issues");
  });

  it("ignores a blank or whitespace-only subject rather than sending an empty one", async () => {
    // An empty subject line reads as spam; better the generic default.
    await deliverWithFallback(target, "body", { subject: "   " });
    expect(sendMail.mock.calls[0]?.[0].subject).toBe("AlphaSeekers notification");

    sendMail.mockClear();
    await deliverWithFallback(target, "body", { subject: "" });
    expect(sendMail.mock.calls[0]?.[0].subject).toBe("AlphaSeekers notification");
  });

  it("trims a padded subject", async () => {
    await deliverWithFallback(target, "body", { subject: "  Spaced out  " });
    expect(sendMail.mock.calls[0]?.[0].subject).toBe("Spaced out");
  });
});
