"use client";

import { signOut } from "next-auth/react";

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

    // Clear service worker caches
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch {
      // caches API may not be available
    }

    await signOut({ callbackUrl });
  }

  return (
    <button
      aria-label="Log out of your account"
      className={variant === "nav"
        ? "text-sm font-medium text-slate-600 hover:text-slate-900"
        : "btn-danger"
      }
      onClick={handleLogout}
      type="button"
    >
      {label}
    </button>
  );
}
