"use client";

import { signOut } from "next-auth/react";

// Must match MATERIAL_CACHE / OFFLINE_CACHE in public/sw.js.
const KEEP_ON_LOGOUT = ["alphaseekers-materials-v1", "alphaseekers-offline-v1"];

type LogoutButtonProps = {
  callbackUrl: string;
  label: string;
  variant?: "nav" | "danger";
};

export function LogoutButton({ callbackUrl, label, variant = "danger" }: LogoutButtonProps) {
  async function handleLogout() {
    // Clear sensitive cached data from localStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch {
      // localStorage may not be available
    }

    // Clear service worker caches that could hold this user's data. Two are
    // deliberately kept (see the header of public/sw.js):
    //  - saved materials: public class files the student chose to keep for
    //    offline study; identical for every student, no account data inside.
    //  - the offline page: fetched without cookies, so it is the signed-out page.
    // Pages are no longer cached per URL at all, so nothing personal remains.
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !KEEP_ON_LOGOUT.includes(name))
          .map((name) => caches.delete(name)),
      );
    } catch {
      // caches API may not be available
    }

    await signOut({ callbackUrl });
  }

  return (
    <button
      className={variant === "nav"
        ? "text-sm font-medium text-ink-soft hover:text-ink-main"
        : "btn-danger"
      }
      onClick={handleLogout}
      type="button"
    >
      {label}
    </button>
  );
}
