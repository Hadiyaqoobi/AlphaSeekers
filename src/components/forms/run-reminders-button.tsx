"use client";

import { useState } from "react";

type ReminderBatchResponse = {
  windowStart: string;
  windowEnd: string;
  sessionsFound: number;
  remindersCreated: number;
  deliveriesSent: number;
};

export function RunRemindersButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setStatus(null);

    const response = await fetch("/api/cron/reminders", {
      method: "POST",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: "Reminder run failed" }))) as { message?: string };
      setStatus(body.message ?? "Reminder run failed");
      setLoading(false);
      return;
    }

    const body = (await response.json()) as ReminderBatchResponse;
    setStatus(
      `Window: ${new Date(body.windowStart).toLocaleString()} - ${new Date(body.windowEnd).toLocaleString()} • Sessions: ${
        body.sessionsFound
      } • Reminders: ${body.remindersCreated} • Sent: ${body.deliveriesSent}`,
    );
    setLoading(false);
  }

  return (
    <div className="panel panel-strong space-y-2 p-4">
      <h2 className="text-lg font-black text-ink-main">Reminders</h2>
      <p className="text-sm text-ink-soft">Sends session reminders to enrolled students within the next hour.</p>
      <button aria-label="Run reminder batch to send session reminders" className="btn-primary" disabled={loading} onClick={run} type="button">
        {loading ? "Running..." : "Run reminder batch"}
      </button>
      {status ? <p className="text-sm text-ink-main">{status}</p> : null}
    </div>
  );
}

