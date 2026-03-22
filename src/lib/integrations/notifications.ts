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

async function sendEmail(target: NotificationTarget, content: string) {
  if (!target.email) {
    throw new NonRetryableError("Missing email address");
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new NonRetryableError("SMTP_USER or SMTP_PASS missing");
  }

  const from = process.env.SMTP_FROM || smtpUser;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const info = await transporter.sendMail({
    from,
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
