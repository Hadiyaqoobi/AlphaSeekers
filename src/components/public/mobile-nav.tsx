"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
import { LogoutButton } from "@/components/logout-button";

type NavItem = {
  href: string;
  label: string;
};

type AuthItem = {
  href: string;
  label: string;
  variant: "link" | "primary";
};

type MobileNavProps = {
  navItems: NavItem[];
  authItems: AuthItem[];
  user: { name: string } | null;
  logoutCallbackUrl: string;
  logoutLabel: string;
};

export function MobileNav({ navItems, authItems, user, logoutCallbackUrl, logoutLabel }: MobileNavProps) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="lg:hidden">
      {/* Hamburger button */}
      <button
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft transition-all duration-200 hover:bg-brand-50 hover:text-brand-500"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          {open ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay backdrop */}
      <div
        className={`mobile-menu-overlay ${open ? "mobile-menu-open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Full-screen slide-in panel */}
      <div
        className={`mobile-menu-panel ${open ? "mobile-menu-open" : ""}`}
        role="dialog"
        aria-modal={open}
        aria-label="Navigation menu"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-line-soft">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/mark-light.svg"
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              className="rounded-xl shadow-md"
            />
            <span className="text-lg font-bold text-ink-main font-display">AlphaSeekers</span>
          </div>
          <button
            onClick={close}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-dark-100 hover:text-ink-main transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-80px)]">
          {/* User info */}
          {user && (
            <div className="flex items-center gap-3 px-6 py-5 bg-brand-50 border-b border-line-soft">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-bold text-ink-main">{user.name}</p>
                <p className="text-xs text-ink-faint">{t("welcome")}</p>
              </div>
            </div>
          )}

          {/* Nav links */}
          <nav className="px-4 py-4">
            <div className="grid gap-1">
              {navItems.map((item, index) => (
                <Link
                  className="flex items-center rounded-xl px-4 py-3.5 text-[15px] font-medium text-ink-main transition-all duration-200 active:bg-brand-50 hover:bg-dark-50 hover:text-brand-600"
                  href={item.href}
                  key={item.href}
                  onClick={close}
                  style={{ animationDelay: open ? `${index * 50}ms` : "0ms" }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Auth actions */}
          {authItems.length > 0 && (
            <div className="px-6 pb-6 pt-2 border-t border-line-soft mt-2">
              <div className="flex flex-col gap-3 pt-4">
                {authItems.map((item) => (
                  <Link
                    className={
                      item.variant === "primary"
                        ? "btn-primary w-full py-3.5 text-center text-[15px]"
                        : "btn-secondary w-full py-3.5 text-center text-[15px]"
                    }
                    href={item.href}
                    key={item.href}
                    onClick={close}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Logout */}
          {user && (
            <div className="px-6 pb-8 pt-2 border-t border-line-soft mt-2">
              <div className="pt-4">
                <LogoutButton callbackUrl={logoutCallbackUrl} label={logoutLabel} variant="nav" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
