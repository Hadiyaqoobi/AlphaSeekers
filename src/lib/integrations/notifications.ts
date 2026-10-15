import { logger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import { NonRetryableError, retryWithBackoff } from "@/lib/retry";
import { sendTelegram } from "./telegram";
import { sendWebPush } from "./web-push";
import nodemailer from "nodemailer";

export type NotificationPrefs = {
  telegram?: boolean;
  webPush?: boolean;
  email?: boolean;
};

export type NotificationTarget = {
  userId: string;
  email?: string | null;
  phone?: string | null;
  telegramChatId?: string | null;
  pushSubscription?: string | null;
  notificationPrefs?: string | null;
};

export type NotificationDelivery = {
  channel: "TELEGRAM" | "WEB_PUSH" | "EMAIL" | "PLATFORM";
  status: "SENT" | "FAILED";
  detail: string;
  /**
   * Only set on a FAILED real channel. False when trying again cannot help (a
   * dead push subscription, a chat Telegram refuses); true for transient faults
   * such as an SMTP 535 or a timeout, where a later retry may well land.
   */
  retryable?: boolean;
};

type CircuitState = {
  failures: number;
  blockedUntil: number;
};

const circuitMap = new Map<string, CircuitState>();
const CIRCUIT_LIMIT = 5;
const CIRCUIT_BLOCK_MS = 5 * 60 * 1000;

function getCircuit(service: string) {
  if (!circuitMap.has(service)) {
    circuitMap.set(service, {
      failures: 0,
      blockedUntil: 0,
    });
  }

  return circuitMap.get(service)!;
}

async function withCircuitBreaker<T>(service: string, operation: () => Promise<T>) {
  const state = getCircuit(service);

  if (Date.now() < state.blockedUntil) {
    throw new Error(`${service} circuit breaker open`);
  }

  try {
    const response = await operation();
    state.failures = 0;
    state.blockedUntil = 0;
    return response;
  } catch (error) {
    // A NonRetryableError is about THIS recipient (a dead subscription, a
    // malformed target), not the provider. Counting it used to trip the breaker
    // after five such students and block the channel for everyone for 5 min.
    if (error instanceof NonRetryableError) {
      throw error;
    }

    state.failures += 1;

    if (state.failures >= CIRCUIT_LIMIT) {
      state.blockedUntil = Date.now() + CIRCUIT_BLOCK_MS;
    }

    throw error;
  }
}

/**
 * Reusable, pooled SMTP transporter — cached at module scope.
 *
 * The previous implementation created a brand-new transporter (and therefore a
 * fresh TLS handshake) for EVERY message, sequentially. Under the reminder
 * batch that meant hundreds of handshakes and hit provider connection limits.
 *
 * With `pool: true` nodemailer keeps a small bank of connections open and
 * reuses them, and `rateLimit`/`maxMessages` keep us under provider throttles.
 *
 * The provider is configurable via env so this can point at a transactional ESP
 * (SES / Postmark / Resend SMTP) instead of Gmail.
 *
 * IMPORTANT: Gmail SMTP is capped at ~500 recipients/day. At any real scale you
 * MUST point SMTP_HOST/PORT/USER/PASS at a transactional ESP — do not rely on
 * Gmail for production reminder blasts.
 */
let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransporterKey = "";

type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function resolveSmtpSettings(): SmtpSettings | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  // Default to Gmail for local/dev convenience; override via env for an ESP.
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  // secure=true for implicit TLS (465); STARTTLS ports (587/25) use secure=false.
  const secure = process.env.SMTP_SECURE
    ? ["1", "true", "yes", "on"].includes(process.env.SMTP_SECURE.trim().toLowerCase())
    : port === 465;
  const from = process.env.SMTP_FROM || user;

  return { host, port, secure, user, pass, from };
}

function getTransporter(settings: SmtpSettings): nodemailer.Transporter {
  // Key on the connection identity so a config change rebuilds the pool.
  const key = `${settings.host}:${settings.port}:${settings.secure}:${settings.user}`;
  if (cachedTransporter && cachedTransporterKey === key) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
    // Connection pooling: reuse a small bank of connections instead of one
    // handshake per message.
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 5),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
    // Cap messages per second so we stay under ESP throttles.
    rateLimit: Number(process.env.SMTP_RATE_LIMIT || 10),
  }) as nodemailer.Transporter;
  cachedTransporterKey = key;
  return cachedTransporter;
}

/**
 * `subject` is optional because most notifications are short operational
 * messages where a generic subject is fine. Anything the team will read as a
 * message from the organisation -- an announcement, an onboarding note --
 * should pass its own, or it lands in their inbox titled "AlphaSeekers
 * notification" and looks like noise.
 */
async function sendEmail(target: NotificationTarget, content: string, subject?: string) {
  if (!target.email) {
    throw new NonRetryableError("Missing email address");
  }

  const settings = resolveSmtpSettings();

  if (!settings) {
    throw new NonRetryableError("SMTP_USER or SMTP_PASS missing");
  }

  const transporter = getTransporter(settings);

  const info = await transporter.sendMail({
    from: settings.from,
    to: target.email,
    subject: subject?.trim() || "AlphaSeekers notification",
    text: content,
  });

  return `Email sent (${info.messageId})`;
}

/**
 * Send a one-off password-reset email directly through the SMTP transporter.
 * A reset link must go to email specifically (not the Telegram/WebPush fallback
 * chain), so this bypasses deliverWithFallback.
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const settings = resolveSmtpSettings();
  if (!settings) {
    throw new NonRetryableError("SMTP_USER or SMTP_PASS missing");
  }

  const transporter = getTransporter(settings);
  const text =
    "We received a request to reset your AlphaSeekers password.\n\n" +
    "Reset it here (this link expires in 1 hour):\n" + resetUrl + "\n\n" +
    "If you didn't request this, you can safely ignore this email \u2014 your password will not change.";
  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">' +
    "<p>We received a request to reset your AlphaSeekers password.</p>" +
    '<p style="margin:18px 0"><a href="' + resetUrl + '" style="display:inline-block;background:#00E676;color:#04140B;font-weight:700;padding:11px 22px;border-radius:8px;text-decoration:none">Reset your password</a></p>' +
    '<p style="color:#667;font-size:13px">This link expires in 1 hour. If you did not request this, you can safely ignore this email &mdash; your password will not change.</p></div>';

  await transporter.sendMail({
    from: settings.from,
    to: email,
    subject: "Reset your AlphaSeekers password",
    text,
    html,
  });
}

/**
 * Send one plain email to an address that may not belong to any account (a
 * certificate issued by hand to someone who is not signed up). Direct SMTP:
 * there is no user, so no Telegram, push or in-site fallback exists.
 */
export async function sendDirectEmail(to: string, subject: string, text: string): Promise<void> {
  const settings = resolveSmtpSettings();
  if (!settings) {
    throw new NonRetryableError("SMTP_USER or SMTP_PASS missing");
  }
  await getTransporter(settings).sendMail({ from: settings.from, to, subject, text });
}

/**
 * Alert the maintainers that an URGENT support ticket was filed. Deliberately
 * direct SMTP rather than deliverWithFallback: this must land in an inbox, not
 * a Telegram chat nobody watches. Normal-priority tickets send nothing at all
 * -- they are picked up in the twice-daily review, which is the point.
 */
export async function sendUrgentTicketEmail(
  to: string[],
  ticket: {
    id: string;
    title: string;
    description: string;
    type: string;
    area?: string | null;
    reporterName: string | null;
    reporterEmail: string | null;
    url: string;
  },
): Promise<void> {
  if (to.length === 0) return;

  const settings = resolveSmtpSettings();
  if (!settings) {
    throw new NonRetryableError("SMTP_USER or SMTP_PASS missing");
  }

  const reporter = ticket.reporterName ?? ticket.reporterEmail ?? "Unknown";
  const where = ticket.area ? `\nArea: ${ticket.area}` : "";
  const text =
    `URGENT ${ticket.type} reported by ${reporter}\n\n` +
    `${ticket.title}\n${where}\n\n` +
    `${ticket.description}\n\n` +
    `Open the ticket: ${ticket.url}\n`;
  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">' +
    `<p style="margin:0 0 6px"><strong style="color:#b00020">URGENT ${escapeHtml(ticket.type)}</strong> reported by ${escapeHtml(reporter)}</p>` +
    `<h2 style="margin:14px 0 4px;font-size:18px">${escapeHtml(ticket.title)}</h2>` +
    (ticket.area ? `<p style="margin:0 0 10px;color:#667;font-size:13px">Area: ${escapeHtml(ticket.area)}</p>` : "") +
    `<p style="white-space:pre-wrap">${escapeHtml(ticket.description)}</p>` +
    `<p style="margin:18px 0"><a href="${ticket.url}" style="display:inline-block;background:#00E676;color:#04140B;font-weight:700;padding:11px 22px;border-radius:8px;text-decoration:none">Open the ticket</a></p></div>`;

  const transporter = getTransporter(settings);
  await transporter.sendMail({
    from: settings.from,
    to: to.join(", "),
    subject: `[URGENT] ${ticket.title}`,
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Record an in-app notice for a user — the platform fallback's actual effect.
 * It used to only build a string, so "delivered via PLATFORM" meant nothing was
 * stored anywhere. Best-effort: a failed insert is logged, never thrown, because
 * the caller has already done everything else it can.
 */
export async function recordPlatformNotice(userId: string, content: string): Promise<boolean> {
  try {
    await prisma.notification.create({
      data: { userId, channel: "PLATFORM", content, status: "SENT", sentAt: new Date() },
    });
    return true;
  } catch (error) {
    logger.warn("in-platform notice could not be stored", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** True when a real channel (Telegram, push, email) carried the message. */
export function landedOnRealChannel(deliveries: NotificationDelivery[]): boolean {
  return deliveries.some((d) => d.status === "SENT" && d.channel !== "PLATFORM");
}

/**
 * True when nothing real landed AND at least one real channel failed in a way a
 * later attempt could fix. That is the case a queued job must retry; a user who
 * simply has no usable channel (opted out of all, nothing linked) is not.
 */
export function deliveryNeedsRetry(deliveries: NotificationDelivery[]): boolean {
  if (landedOnRealChannel(deliveries)) return false;
  return deliveries.some((d) => d.channel !== "PLATFORM" && d.status === "FAILED" && d.retryable !== false);
}

/**
 * Deliver a notification using the fallback chain:
 * Telegram → Web Push → Email → Platform
 *
 * Returns on first successful delivery. A channel the user has no target on (no
 * chat linked, no push subscription, no address) is skipped outright: it never
 * reaches the circuit breaker and is not reported as a failure. A provider that
 * is not configured still shows up as a non-retryable FAILED delivery, so the
 * misconfiguration stays visible without tripping the breaker. The Platform step is the last resort and is reported SENT for
 * backward compatibility — callers that must know whether anything really went
 * out use `landedOnRealChannel` / `deliveryNeedsRetry`.
 */
function parsePrefs(raw?: string | null): NotificationPrefs {
  if (!raw) return { telegram: true, webPush: true, email: true };
  try {
    return JSON.parse(raw) as NotificationPrefs;
  } catch {
    return { telegram: true, webPush: true, email: true };
  }
}

export type DeliveryOptions = {
  /** Email subject line. Ignored by Telegram/push, which have no subject. */
  subject?: string;
  /**
   * Store an in-app Notification row when the chain ends on the Platform step.
   * Off by default because most direct callers already persist one row per
   * delivery themselves and would otherwise get it twice. Not written when a
   * real channel failed transiently: the caller is about to retry, and one row
   * per attempt would stack duplicates in the user's feed.
   */
  recordPlatformNotice?: boolean;
};

async function attemptChannel(
  service: string,
  channel: NotificationDelivery["channel"],
  send: () => Promise<string>,
  fallbackMessage: string,
): Promise<NotificationDelivery> {
  try {
    const detail = await withCircuitBreaker(service, () => retryWithBackoff(send));
    return { channel, status: "SENT", detail };
  } catch (error) {
    return {
      channel,
      status: "FAILED",
      detail: error instanceof Error ? error.message : fallbackMessage,
      retryable: !(error instanceof NonRetryableError),
    };
  }
}

export async function deliverWithFallback(
  target: NotificationTarget,
  content: string,
  options: DeliveryOptions = {},
): Promise<NotificationDelivery[]> {
  const deliveries: NotificationDelivery[] = [];
  const prefs = parsePrefs(target.notificationPrefs);

  // 1. Try Telegram (if user hasn't disabled it and has actually linked a chat)
  if (prefs.telegram !== false && target.telegramChatId) {
    const outcome = await attemptChannel("telegram", "TELEGRAM", () => sendTelegram(target, content), "Telegram delivery failed");
    deliveries.push(outcome);
    if (outcome.status === "SENT") return deliveries;
  }

  // 2. Try Web Push (if user hasn't disabled it and has a subscription)
  if (prefs.webPush !== false && target.pushSubscription) {
    const outcome = await attemptChannel("webpush", "WEB_PUSH", () => sendWebPush(target, content), "Web Push delivery failed");
    deliveries.push(outcome);
    if (outcome.status === "SENT") return deliveries;
  }

  // 3. Try Email (if user hasn't disabled it and has an address)
  if (prefs.email !== false && target.email) {
    const outcome = await attemptChannel("email", "EMAIL", () => sendEmail(target, content, options.subject), "Email delivery failed");
    deliveries.push(outcome);
    if (outcome.status === "SENT") return deliveries;
  }

  // 4. Platform fallback (cannot be disabled). Loud when a real channel was
  //    tried and failed: that is how a revoked SMTP password used to go unseen.
  const failed = deliveries.filter((d) => d.status === "FAILED");
  if (failed.length > 0) {
    logger.warn("notification fell back to in-platform only", {
      userId: target.userId,
      failures: failed.map((d) => `${d.channel}: ${d.detail}`),
    });
  }

  let recorded = false;
  if (options.recordPlatformNotice && !deliveryNeedsRetry(deliveries)) {
    recorded = await recordPlatformNotice(target.userId, content);
  }

  deliveries.push({
    channel: "PLATFORM",
    status: "SENT",
    detail: recorded ? `In-platform notice stored for ${target.userId}` : `In-platform fallback for ${target.userId}`,
  });
  return deliveries;
}
