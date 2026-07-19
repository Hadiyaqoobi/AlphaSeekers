"use client";

import { useState } from "react";

/** Serializable audit row (createdAt is an ISO string across the wire). */
export type AuditRow = {
  id: string;
  actorId: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export function AuditTable({
  initial,
}: {
  initial: { items: AuditRow[]; nextCursor: string | null };
}) {
  const [items, setItems] = useState<AuditRow[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super/audit?cursor=${encodeURIComponent(cursor)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load more (HTTP ${res.status})`);
      const data = (await res.json()) as { items: AuditRow[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...(data.items ?? [])]);
      setCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more entries");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/5 bg-dark-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-ink-soft">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-faint">
                    No audit activity recorded yet.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-white/5">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-ink-main">
                      {row.actorEmail ?? <span className="text-ink-faint">{row.actorId}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs font-semibold text-ink-soft">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      <span className="font-medium text-ink-main">{row.targetType}</span>
                      <span className="text-ink-faint"> · {row.targetId}</span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs text-ink-soft">
                      {row.details ? (
                        <span className="break-words">{row.details}</span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-center">
        {cursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-dark-100 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : (
          items.length > 0 && <p className="text-xs text-ink-faint">End of audit log.</p>
        )}
      </div>
    </div>
  );
}
