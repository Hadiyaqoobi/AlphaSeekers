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
let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
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

function getTransporter(settings: SmtpSettings) {
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
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

async function sendEmail(target: NotificationTarget, content: string) {
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
    subject: "AlphaSeekers notification",
    text: content,
  });

  return `Email sent (${info.messageId})`;
}

async function sendPlatform(target: NotificationTarget, content: string) {
  return `In-platform notice for ${target.userId}: ${content.slice(0, 80)}`;
}

/**
 * Deliver a notification using the fallback chain:
 * Telegram → Web Push → Email → Platform
 *
 * Returns on first successful delivery. Platform always succeeds as last resort.
 */
function parsePrefs(raw?: string | null): NotificationPrefs {
  if (!raw) return { telegram: true, webPush: true, email: true };
  try {
    return JSON.parse(raw) as NotificationPrefs;
  } catch {
    return { telegram: true, webPush: true, email: true };
  }
}

export async function deliverWithFallback(target: NotificationTarget, content: string): Promise<NotificationDelivery[]> {
  const deliveries: NotificationDelivery[] = [];
  const prefs = parsePrefs(target.notificationPrefs);

  // 1. Try Telegram (if user hasn't disabled it)
  if (prefs.telegram !== false) {
    try {
      const detail = await withCircuitBreaker("telegram", () => retryWithBackoff(() => sendTelegram(target, content)));
      deliveries.push({ channel: "TELEGRAM", status: "SENT", detail });
      return deliveries;
    } catch (error) {
      deliveries.push({
        channel: "TELEGRAM",
        status: "FAILED",
        detail: error instanceof Error ? error.message : "Telegram delivery failed",
      });
    }
  }

  // 2. Try Web Push (if user hasn't disabled it)
  if (prefs.webPush !== false) {
    try {
      const detail = await withCircuitBreaker("webpush", () => retryWithBackoff(() => sendWebPush(target, content)));
      deliveries.push({ channel: "WEB_PUSH", status: "SENT", detail });
      return deliveries;
    } catch (error) {
      deliveries.push({
        channel: "WEB_PUSH",
        status: "FAILED",
        detail: error instanceof Error ? error.message : "Web Push delivery failed",
      });
    }
  }

  // 3. Try Email (if user hasn't disabled it)
  if (prefs.email !== false) {
    try {
      const detail = await withCircuitBreaker("email", () => retryWithBackoff(() => sendEmail(target, content)));
      deliveries.push({ channel: "EMAIL", status: "SENT", detail });
      return deliveries;
    } catch (error) {
      deliveries.push({
        channel: "EMAIL",
        status: "FAILED",
        detail: error instanceof Error ? error.message : "Email delivery failed",
      });
    }
  }

  // 4. Platform fallback (always succeeds, cannot be disabled)
  const detail = await sendPlatform(target, content);
  deliveries.push({ channel: "PLATFORM", status: "SENT", detail });
  return deliveries;
}
