import webpush from "web-push";

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

  const result = await webpush.sendNotification(subscription, payload);
  return `Web Push sent (${result.statusCode})`;
}
