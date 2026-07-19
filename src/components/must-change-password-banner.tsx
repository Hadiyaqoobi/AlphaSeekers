'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Props = {
  locale: string;
};

const DISMISS_KEY = 'must-change-password-dismissed';

/**
 * Persistent (per-session dismissible) reminder for employees still using the
 * temporary password issued when their account was created. We deliberately do
 * NOT hard-redirect — a visible banner avoids redirect loops while still nudging
 * the user to /[locale]/change-password.
 */
export function MustChangePasswordBanner({ locale }: Props) {
  const [dismissed, setDismissed] = useState(true);

  // Read the per-session dismissal only on the client to avoid hydration flash.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sessionStorage unavailable — dismiss for this render only. */
    }
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900"
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </span>
      <span className="flex-1 min-w-[12rem] font-medium">
        Your account uses a temporary password. Please set a new password.
      </span>
      <Link
        href={`/${locale}/change-password`}
        className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
      >
        Set new password
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-amber-700 transition-colors hover:bg-amber-100"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
