import webpush from "web-push";

import { NonRetryableError } from "@/lib/retry";

import type { NotificationTarget } from "./notifications";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

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

  const subscription = JSON.parse(target.pushSubscription) as webpush.PushSubscription;

  const payload = JSON.stringify({
    title: "AlphaSeekers",
    body: content.length > 200 ? content.slice(0, 197) + "..." : content,
    icon: "/icon-192.png",
    url: "/fa/dashboard",
  });

  const result = await webpush.sendNotification(subscription, payload);
  return `Web Push sent (${result.statusCode})`;
}
