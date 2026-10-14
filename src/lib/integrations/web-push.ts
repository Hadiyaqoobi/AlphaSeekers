import webpush from "web-push";

import { prisma } from "@/lib/prisma";
import { NonRetryableError } from "@/lib/retry";

import type { NotificationTarget } from "./notifications";

let vapidConfigured = false;

/**
 * Whether VAPID keys are present. Callers can use this to skip the web-push
 * channel entirely instead of triggering a failed-delivery per recipient.
 */
export function isWebPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function ensureVapid() {
  if (vapidConfigured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  // Degrade gracefully: a NonRetryableError is caught by the fallback chain and
  // does NOT trigger retry storms. We simply skip the channel when unconfigured.
  if (!publicKey || !privateKey || !subject) {
    throw new NonRetryableError("VAPID keys not configured");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function sendWebPush(target: NotificationTarget, content: string): Promise<string> {
  if (!target.pushSubscription) {
    throw new NonRetryableError("No push subscription for user");
  }

  ensureVapid();

  let subscription: webpush.PushSubscription;
  try {
    subscription = JSON.parse(target.pushSubscription) as webpush.PushSubscription;
  } catch {
    // A malformed stored subscription can never succeed — don't retry it.
    throw new NonRetryableError("Malformed push subscription");
  }

  const body = content.length > 200 ? content.slice(0, 197) + "..." : content;
  const url = "/fa/dashboard";

  // Payload shape aligned with the service worker's `push` / `notificationclick`
  // handlers (sw.js): the SW reads title/body/icon/badge and opens `data.url`.
  const payload = JSON.stringify({
    title: "AlphaSeekers",
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    url,
    data: { url },
  });

  let result: webpush.SendResult;
  try {
    result = await webpush.sendNotification(subscription, payload);
  } catch (error) {
    // 404/410 mean the browser dropped this subscription for good. Retrying it
    // three times with backoff on every notification only delayed the email
    // fallback, so forget it and let the chain move on.
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await forgetSubscription(target.userId, target.pushSubscription);
      throw new NonRetryableError(`Push subscription expired (${statusCode})`);
    }
    throw error;
  }
  return `Web Push sent (${result.statusCode})`;
}

/**
 * Clear a dead subscription. Matched on the exact stored value so a fresh
 * subscription saved in the meantime is never wiped. Best-effort: failing to
 * clean up must not change the delivery outcome.
 */
async function forgetSubscription(userId: string, subscription: string): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId, pushSubscription: subscription },
      data: { pushSubscription: null },
    });
  } catch (error) {
    console.error("[web-push] could not clear expired subscription", userId, error);
  }
}
