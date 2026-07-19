"use client";

import { useCallback, useState } from "react";

import { StatCard } from "./stat-card";

const NEON = "#00C853";
const CYAN = "#00B8D4";
const BLUE = "#2962FF";
const AMBER = "#FFA000";
const RED = "#DC2626";

/** Wire shape for a dead-lettered job (updatedAt is an ISO string). */
export type DeadJobDTO = {
  id: string;
  type: string;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
};

export type QueueHealthDTO = {
  counts: Record<string, number>;
  oldestPendingAgeMs: number | null;
};

export type JobOpsData = {
  health: QueueHealthDTO;
  dead: DeadJobDTO[];
};

/** Status tiles rendered left-to-right, each with a status-appropriate accent. */
const STATUS_TILES: { key: string; label: string; accent: string }[] = [
  { key: "PENDING", label: "Pending", accent: AMBER },
  { key: "ACTIVE", label: "Active", accent: BLUE },
  { key: "COMPLETED", label: "Completed", accent: NEON },
  { key: "FAILED", label: "Failed", accent: AMBER },
  { key: "DEAD", label: "Dead", accent: RED },
];

/** Humanize a millisecond age into a compact "3m" / "2h" / "1d" string. */
function formatAge(ms: number | null): string {
  if (ms === null) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Trim a long error message for the table cell; full text lives on hover. */
function truncate(value: string, max = 140): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function JobOps({ initial }: { initial: JobOpsData; locale: string }) {
  const [data, setData] = useState<JobOpsData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requeuing, setRequeuing] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super/jobs", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load queue health (HTTP ${res.status})`);
      const next = (await res.json()) as JobOpsData;
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue health");
    } finally {
      setLoading(false);
    }
  }, []);

  const requeue = useCallback(
    async (jobId: string) => {
      setError(null);
      setRequeuing((prev) => new Set(prev).add(jobId));
      try {
        const res = await fetch("/api/super/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "requeue", jobId }),
        });
        if (!res.ok) throw new Error(`Requeue failed (HTTP ${res.status})`);
        const body = (await res.json()) as { ok?: boolean };
        if (!body.ok) throw new Error("Job was no longer dead or failed — nothing requeued");
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to requeue job");
      } finally {
        setRequeuing((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      }
    },
    [refresh],
  );

  const { counts, oldestPendingAgeMs } = data.health;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Job operations</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Durable queue health and dead-letter recovery. Requeue resets a job to run again now.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STATUS_TILES.map((tile) => (
          <StatCard key={tile.key} label={tile.label} value={counts[tile.key] ?? 0} accent={tile.accent} />
        ))}
        <StatCard
          label="Oldest pending"
          value={formatAge(oldestPendingAgeMs)}
          hint={oldestPendingAgeMs === null ? "Queue drained" : "Age of oldest waiting job"}
          accent={CYAN}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Dead-letter queue</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Jobs that exhausted their retries. Fix the root cause, then requeue.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Last error</th>
                <th className="px-4 py-3">Dead since</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.dead.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                    No dead-lettered jobs. The queue is healthy.
                  </td>
                </tr>
              ) : (
                data.dead.map((job) => {
                  const busy = requeuing.has(job.id);
                  return (
                    <tr key={job.id} className="align-top">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-mono text-xs font-semibold text-gray-700">
                          {job.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-700">{job.attempts}</td>
                      <td className="max-w-md px-4 py-3 text-xs text-gray-500">
                        {job.lastError ? (
                          <span className="break-words" title={job.lastError}>
                            {truncate(job.lastError)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {new Date(job.updatedAt).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => requeue(job.id)}
                          disabled={busy}
                          className="rounded-lg border border-neon-200 bg-neon-50 px-3 py-1.5 text-xs font-semibold text-neon-700 transition hover:bg-neon-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? "Requeuing…" : "Requeue"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
