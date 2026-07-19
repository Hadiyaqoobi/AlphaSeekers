"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

type SchedulerSession = {
  id: string;
  startTime: string;
  endTime: string;
  meetLink: string | null;
  meetLinkStatus: "GENERATED" | "PENDING" | "FAILED";
  cancelled: boolean;
  confirmedAt: string | null;
};

type SessionSchedulerProps = {
  classId: string;
  locale: string;
  className: string;
  schedulingMode: "AUTO" | "MANUAL";
  sessions: SchedulerSession[];
};

const DEFAULT_DURATION = 60;
const MIN_DURATION = 15;
const MAX_DURATION = 480;

const PILL_BASE =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";
const INPUT =
  "rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-neon-500 focus:outline-none focus:ring-2 focus:ring-neon-100";
const BTN_PRIMARY =
  "inline-flex items-center rounded-lg bg-neon-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neon-700 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO/Date -> value for <input type="datetime-local"> in the browser's local time. */
function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function durationMinutes(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_DURATION;
  return Math.round(ms / 60_000);
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DURATION;
  return Math.min(Math.max(Math.round(value), MIN_DURATION), MAX_DURATION);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: unknown };
    if (data && typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
  } catch {
    // Fall through to the generic message when the body is not JSON.
  }
  return "Something went wrong. Please try again.";
}

function StatusPill({ session }: { session: SchedulerSession }) {
  if (session.meetLinkStatus === "GENERATED") {
    if (session.meetLink) {
      return (
        <a
          className={`${PILL_BASE} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
          href={session.meetLink}
          rel="noreferrer"
          target="_blank"
        >
          Join
        </a>
      );
    }
    return (
      <span className={`${PILL_BASE} border-emerald-200 bg-emerald-50 text-emerald-700`}>
        Meet ready
      </span>
    );
  }
  if (session.meetLinkStatus === "PENDING") {
    return (
      <span className={`${PILL_BASE} border-amber-200 bg-amber-50 text-amber-700`}>
        link pending
      </span>
    );
  }
  return (
    <span className={`${PILL_BASE} border-red-200 bg-red-50 text-red-700`}>link failed</span>
  );
}

export function SessionScheduler({
  classId,
  locale,
  className,
  schedulingMode,
  sessions,
}: SessionSchedulerProps) {
  const router = useRouter();
  const localeTag = locale === "fa" ? "fa-AF" : "en-US";

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-session inline form.
  const [addOpen, setAddOpen] = useState(false);
  const [addStart, setAddStart] = useState("");
  const [addDuration, setAddDuration] = useState(DEFAULT_DURATION);

  // Reschedule inline form (only one session open at a time).
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleDuration, setRescheduleDuration] = useState(DEFAULT_DURATION);

  function formatWhen(iso: string): string {
    try {
      return new Date(iso).toLocaleString(localeTag, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return new Date(iso).toLocaleString();
    }
  }

  function openAdd() {
    setError(null);
    setAddStart(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
    setAddDuration(DEFAULT_DURATION);
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
    setAddStart("");
  }

  function openReschedule(session: SchedulerSession) {
    setError(null);
    setRescheduleId(session.id);
    setRescheduleStart(toLocalInputValue(new Date(session.startTime)));
    setRescheduleDuration(durationMinutes(session.startTime, session.endTime));
  }

  function closeReschedule() {
    setRescheduleId(null);
    setRescheduleStart("");
  }

  async function mutate(
    key: string,
    run: () => Promise<Response>,
    onSuccess?: () => void,
  ): Promise<void> {
    setBusy(key);
    setError(null);
    try {
      const response = await run();
      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }
      onSuccess?.();
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  function submitAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!addStart) {
      setError("Please choose a date and time.");
      return;
    }
    const start = new Date(addStart);
    if (Number.isNaN(start.getTime())) {
      setError("That date and time is not valid.");
      return;
    }
    void mutate(
      "add",
      () =>
        fetch(`/api/teacher/classes/${classId}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: start.toISOString(),
            durationMinutes: clampDuration(addDuration),
          }),
        }),
      closeAdd,
    );
  }

  function submitReschedule(event: React.FormEvent, sessionId: string) {
    event.preventDefault();
    if (!rescheduleStart) {
      setError("Please choose a date and time.");
      return;
    }
    const start = new Date(rescheduleStart);
    if (Number.isNaN(start.getTime())) {
      setError("That date and time is not valid.");
      return;
    }
    void mutate(
      `reschedule:${sessionId}`,
      () =>
        fetch(`/api/teacher/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: start.toISOString(),
            durationMinutes: clampDuration(rescheduleDuration),
          }),
        }),
      closeReschedule,
    );
  }

  function confirm(sessionId: string) {
    void mutate(`confirm:${sessionId}`, () =>
      fetch(`/api/teacher/sessions/${sessionId}/confirm`, { method: "POST" }),
    );
  }

  function cancel(sessionId: string) {
    void mutate(`cancel:${sessionId}`, () =>
      fetch(`/api/classes/${classId}/sessions/${sessionId}/cancel`, { method: "POST" }),
    );
  }

  const busyAny = busy !== null;

  return (
    <div
      aria-label={`Sessions for ${className}`}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">Sessions</h2>
        {!addOpen ? (
          <button className={BTN_PRIMARY} disabled={busyAny} onClick={openAdd} type="button">
            Add session
          </button>
        ) : null}
      </div>

      {schedulingMode === "AUTO" ? (
        <p className="mt-1 text-sm text-gray-500">
          This class is on automatic scheduling. Adding a session here creates a confirmed,
          instructor-set session alongside any auto-proposed ones.
        </p>
      ) : null}

      {addOpen ? (
        <form
          className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
          onSubmit={submitAdd}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700" htmlFor="add-start">
                Date &amp; time
              </label>
              <input
                className={INPUT}
                id="add-start"
                onChange={(event) => setAddStart(event.target.value)}
                required
                type="datetime-local"
                value={addStart}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-700" htmlFor="add-duration">
                Duration (minutes)
              </label>
              <input
                className={`${INPUT} w-32`}
                id="add-duration"
                max={MAX_DURATION}
                min={MIN_DURATION}
                onChange={(event) => setAddDuration(Number(event.target.value))}
                step={5}
                type="number"
                value={addDuration}
              />
            </div>
            <div className="flex items-center gap-2">
              <button className={BTN_PRIMARY} disabled={busyAny} type="submit">
                {busy === "add" ? "Adding…" : "Create session"}
              </button>
              <button
                className={BTN_SECONDARY}
                disabled={busyAny}
                onClick={closeAdd}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No sessions yet. Add one to get started.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sessions.map((session) => {
            const isConfirmed = session.confirmedAt !== null;
            const rescheduleBusy = busy === `reschedule:${session.id}`;
            const confirmBusy = busy === `confirm:${session.id}`;
            const cancelBusy = busy === `cancel:${session.id}`;
            const isRescheduling = rescheduleId === session.id;

            return (
              <li
                className={`rounded-lg border border-gray-200 p-4 ${
                  session.cancelled ? "bg-gray-50 opacity-70" : "bg-white"
                }`}
                key={session.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900" suppressHydrationWarning>
                      {formatWhen(session.startTime)}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {durationMinutes(session.startTime, session.endTime)} min
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {session.cancelled ? (
                        <span
                          className={`${PILL_BASE} border-gray-200 bg-gray-100 text-gray-500`}
                        >
                          Cancelled
                        </span>
                      ) : (
                        <>
                          <StatusPill session={session} />
                          {isConfirmed ? (
                            <span
                              className={`${PILL_BASE} border-neon-200 bg-neon-50 text-neon-700`}
                            >
                              Confirmed
                            </span>
                          ) : (
                            <span
                              className={`${PILL_BASE} border-amber-200 bg-amber-50 text-amber-700`}
                            >
                              Proposed
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {!session.cancelled ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className={BTN_SECONDARY}
                        disabled={busyAny}
                        onClick={() =>
                          isRescheduling ? closeReschedule() : openReschedule(session)
                        }
                        type="button"
                      >
                        {isRescheduling ? "Close" : "Reschedule"}
                      </button>
                      {!isConfirmed ? (
                        <button
                          className={BTN_SECONDARY}
                          disabled={busyAny}
                          onClick={() => confirm(session.id)}
                          type="button"
                        >
                          {confirmBusy ? "Confirming…" : "Confirm"}
                        </button>
                      ) : null}
                      <button
                        className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busyAny}
                        onClick={() => cancel(session.id)}
                        type="button"
                      >
                        {cancelBusy ? "Cancelling…" : "Cancel"}
                      </button>
                    </div>
                  ) : null}
                </div>

                {isRescheduling && !session.cancelled ? (
                  <form
                    className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
                    onSubmit={(event) => submitReschedule(event, session.id)}
                  >
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="flex flex-col gap-1">
                        <label
                          className="text-xs font-semibold text-gray-700"
                          htmlFor={`reschedule-start-${session.id}`}
                        >
                          New date &amp; time
                        </label>
                        <input
                          className={INPUT}
                          id={`reschedule-start-${session.id}`}
                          onChange={(event) => setRescheduleStart(event.target.value)}
                          required
                          type="datetime-local"
                          value={rescheduleStart}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label
                          className="text-xs font-semibold text-gray-700"
                          htmlFor={`reschedule-duration-${session.id}`}
                        >
                          Duration (minutes)
                        </label>
                        <input
                          className={`${INPUT} w-32`}
                          id={`reschedule-duration-${session.id}`}
                          max={MAX_DURATION}
                          min={MIN_DURATION}
                          onChange={(event) =>
                            setRescheduleDuration(Number(event.target.value))
                          }
                          step={5}
                          type="number"
                          value={rescheduleDuration}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button className={BTN_PRIMARY} disabled={busyAny} type="submit">
                          {rescheduleBusy ? "Saving…" : "Save new time"}
                        </button>
                        <button
                          className={BTN_SECONDARY}
                          disabled={busyAny}
                          onClick={closeReschedule}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
