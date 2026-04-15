'use client';

import type { ReactNode } from 'react';

export function NavChrome({ children, isLoggedIn }: { children: ReactNode; isLoggedIn: boolean }) {
  // If user is logged in, hide the top nav — they use the sidebar instead
  if (isLoggedIn) return null;

  return <>{children}</>;
}
