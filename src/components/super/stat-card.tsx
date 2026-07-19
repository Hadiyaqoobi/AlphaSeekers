/**
 * A single KPI tile — light card on white with an optional neon accent bar and
 * a sub-line for context (trend, secondary count, etc.). No interactivity, so
 * this is a shared component usable in server or client trees.
 */

import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  accent = "#00C853", // neon-600
  children,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
  /** Optional extra content (e.g. a sparkline) rendered below the value. */
  children?: ReactNode;
}) {
  const shown = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-dark-100 p-5">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.7 }}
      />
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink-main tabular-nums">{shown}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
