"use client";

import { useState } from "react";

export function RunSchedulerButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setStatus(null);

    // Each request processes one bounded batch (kept small to stay inside
    // serverless limits). Loop across batches until the scheduler reports it is
    // done, so a single click drains the whole queue instead of only the first
    // 10 classes. A safety cap prevents an unbounded loop if `completed` never
    // flips.
    let totalProcessed = 0;
    const MAX_BATCHES = 1000;

    try {
      for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
        const response = await fetch("/api/cron/scheduler", { method: "POST" });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({ message: "Scheduler run failed" }))) as {
            message?: string;
          };
          setStatus(body.message ?? "Scheduler run failed");
          return;
        }

        const body = (await response.json()) as {
          batchProcessed: number;
          remaining: number;
          completed: boolean;
        };

        totalProcessed += body.batchProcessed;

        if (body.completed) {
          setStatus(`Scheduler completed. Processed ${totalProcessed} classes across all batches.`);
          return;
        }

        setStatus(
          `Processed ${totalProcessed} classes so far. Remaining: ${body.remaining}. Continuing...`,
        );

        // Nothing left to make progress on — avoid spinning forever.
        if (body.batchProcessed === 0) {
          setStatus(`Scheduler stopped. Processed ${totalProcessed} classes; ${body.remaining} remaining.`);
          return;
        }
      }

      setStatus(`Reached batch limit after processing ${totalProcessed} classes. Run again to continue.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel panel-strong space-y-2 p-4">
      <h2 className="text-lg font-black text-ink-main">Scheduler</h2>
      <p className="text-sm text-ink-soft">Processes classes in small batches to stay inside serverless limits, looping until the whole queue is drained.</p>
      <button
        aria-label="Run scheduler batch to process classes"
        className="btn-primary"
        disabled={loading}
        onClick={run}
        type="button"
      >
        {loading ? "Running..." : "Run scheduler batch"}
      </button>
      {status ? <p className="text-sm text-ink-main">{status}</p> : null}
    </div>
  );
}
