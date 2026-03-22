"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type PushState = "loading" | "unsupported" | "denied" | "subscribed" | "prompt";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushSubscribe() {
  const t = useTranslations("pushNotifications");
  const [state, setState] = useState<PushState>("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    if (Notification.permission === "granted") {
      // Check if already subscribed
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setState(sub ? "subscribed" : "prompt"))
        .catch(() => setState("prompt"));
      return;
    }

    setState("prompt");
  }, []);

  async function subscribe() {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setState("unsupported");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await fetch("/api/me/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setState("subscribed");
    } catch {
      setState("prompt");
    }
  }

  if (state === "loading" || state === "unsupported" || state === "subscribed") {
    return null;
  }

  if (state === "denied") {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        {t("denied")}
      </p>
    );
  }

  return (
    <button
      className="btn-secondary text-xs"
      onClick={subscribe}
      type="button"
    >
      {t("enable")}
    </button>
  );
}
