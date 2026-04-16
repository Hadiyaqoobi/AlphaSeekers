"use client";

import { useState } from "react";

export function RunSchedulerButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setStatus(null);

    const response = await fetch("/api/cron/scheduler", {
      method: "POST",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: "Scheduler run failed" }))) as { message?: string };
      setStatus(body.message ?? "Scheduler run failed");
      setLoading(false);
      return;
    }

    const body = (await response.json()) as {
      batchProcessed: number;
      remaining: number;
      completed: boolean;
    };

    setStatus(
      body.completed
        ? `Scheduler completed. Processed ${body.batchProcessed} classes in this run.`
        : `Batch processed ${body.batchProcessed} classes. Remaining: ${body.remaining}.`,
    );
    setLoading(false);
  }

  return (
    <div className="panel panel-strong space-y-2 p-4">
      <h2 className="text-lg font-black text-ink-main">Scheduler</h2>
      <p className="text-sm text-ink-soft">Runs 10 classes per invocation to stay inside serverless limits.</p>
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
