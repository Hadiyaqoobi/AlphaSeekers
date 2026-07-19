"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Tab bar for the Super Admin console. Highlights the active tab based on the
 * current pathname. Internal staff tooling — English copy, no next-intl.
 */
export function SuperSubnav({ locale }: { locale: string }) {
  const pathname = usePathname();
  const base = `/${locale}/super`;

  const tabs: { href: string; label: string; exact?: boolean }[] = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/employees`, label: "Employees" },
    { href: `${base}/jobs`, label: "Jobs" },
    { href: `${base}/audit`, label: "Audit log" },
    { href: `${base}/system`, label: "System" },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="flex flex-wrap gap-1 border-b border-white/10" aria-label="Super Admin sections">
      {tabs.map((tab) => {
        const active = isActive(tab.href, tab.exact);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              active
                ? "border-neon-500 text-neon-400"
                : "border-transparent text-ink-soft hover:border-white/20 hover:text-ink-main"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
