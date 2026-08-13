"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string | null };
};

type Ticket = {
  id: string;
  title: string;
  description: string;
  type: "BUG" | "FEATURE" | "QUESTION";
  priority: "NORMAL" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "WONT_DO";
  area: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string | null; email: string | null };
  comments: Comment[];
};

const STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "WONT_DO"] as const;

export function TicketDetail({
  ticket,
  canManage,
  currentUserId,
}: {
  ticket: Ticket;
  canManage: boolean;
  currentUserId: string;
}) {
  const t = useTranslations("support");
  const router = useRouter();

  const [status, setStatus] = useState(ticket.status);
  const [comments, setComments] = useState<Comment[]>(ticket.comments);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(next: string) {
    setBusy(true);
    setError(null);
    const previous = status;
    setStatus(next as Ticket["status"]);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setStatus(previous);
      setError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setReply("");
    } catch {
      setError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <header className="rounded-2xl border border-white/5 bg-dark-100 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-ink-soft">
            {t(`type_${ticket.type}`)}
          </span>
          {ticket.priority === "URGENT" ? (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-red-300">
              {t("urgent")}
            </span>
          ) : null}
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-ink-soft">
            {t(`status_${status}`)}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-main sm:text-3xl">{ticket.title}</h1>
        <p className="mt-2 text-xs text-ink-faint">
          {t("reportedBy", { name: ticket.reporter.name ?? ticket.reporter.email ?? "—" })} ·{" "}
          {new Date(ticket.createdAt).toLocaleString()}
          {ticket.area ? ` · ${ticket.area}` : ""}
        </p>

        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-ink-main">{ticket.description}</p>

        {ticket.attachmentUrl ? (
          <a
            className="mt-4 inline-block text-sm text-neon-400 underline"
            href={ticket.attachmentUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("viewAttachment")}
          </a>
        ) : null}

        {canManage ? (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/5 pt-5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="ticket-set-status">
              {t("setStatus")}
            </label>
            <select
              className="rounded-lg border border-white/10 bg-dark-50 px-3 py-2 text-sm text-ink-main"
              disabled={busy}
              id="ticket-set-status"
              onChange={(e) => void changeStatus(e.target.value)}
              value={status}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status_${s}`)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      {/* The thread that replaces the reply email. */}
      <section className="rounded-2xl border border-white/5 bg-dark-100 p-6">
        <h2 className="text-lg font-semibold text-ink-main">{t("conversation")}</h2>

        {comments.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t("noComments")}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {comments.map((c) => (
              <li
                className={`rounded-xl border p-4 ${
                  c.author.id === currentUserId ? "border-neon-400/25 bg-neon-400/5" : "border-white/10 bg-dark-50"
                }`}
                key={c.id}
              >
                <p className="text-xs font-semibold text-ink-soft">
                  {c.author.name ?? c.author.email ?? "—"} · {new Date(c.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink-main">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form className="mt-5 space-y-3" onSubmit={postComment}>
          <textarea
            className="w-full rounded-lg border border-white/10 bg-dark-50 px-3 py-2.5 text-sm text-ink-main"
            maxLength={5000}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t("replyPlaceholder")}
            rows={4}
            value={reply}
          />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button className="btn-primary px-5 py-2.5 text-sm" disabled={busy || !reply.trim()} type="submit">
            {busy ? t("saving") : t("postReply")}
          </button>
        </form>
      </section>
    </div>
  );
}
