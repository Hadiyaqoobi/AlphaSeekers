"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type Ticket = {
  id: string;
  title: string;
  type: "BUG" | "FEATURE" | "QUESTION";
  priority: "NORMAL" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "WONT_DO";
  area: string | null;
  createdAt: string;
  commentCount: number;
  reporter: { id: string; name: string | null; email: string | null };
};

const STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "WONT_DO"] as const;
const TYPES = ["BUG", "FEATURE", "QUESTION"] as const;

export function TicketQueue({
  canManage,
  canCreate,
  locale,
}: {
  canManage: boolean;
  canCreate: boolean;
  locale: string;
}) {
  const t = useTranslations("support");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<string>("OPEN");
  const [type, setType] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets?status=${status}&type=${type}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [status, type, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      {/* Filters + new ticket */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="ticket-status">
          {t("filterStatus")}
        </label>
        <select
          className="rounded-lg border border-white/10 bg-dark-100 px-3 py-2 text-sm text-ink-main"
          id="ticket-status"
          onChange={(e) => setStatus(e.target.value)}
          value={status}
        >
          <option value="ALL">{t("statusAll")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status_${s}`)}
            </option>
          ))}
        </select>

        <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="ticket-type">
          {t("filterType")}
        </label>
        <select
          className="rounded-lg border border-white/10 bg-dark-100 px-3 py-2 text-sm text-ink-main"
          id="ticket-type"
          onChange={(e) => setType(e.target.value)}
          value={type}
        >
          <option value="ALL">{t("typeAll")}</option>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`type_${ty}`)}
            </option>
          ))}
        </select>

        {canCreate ? (
          <button className="btn-primary ml-auto px-5 py-2.5 text-sm" onClick={() => setShowForm((v) => !v)} type="button">
            {showForm ? t("cancel") : t("newTicket")}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <NewTicketForm
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      ) : null}

      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="p-6 text-sm text-ink-soft">{t("loading")}</p>
      ) : tickets.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-dark-100 p-8 text-center text-sm text-ink-soft">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                className="block rounded-2xl border border-white/5 bg-dark-100 p-5 transition hover:border-white/15"
                href={`/${locale}/admin/support/${ticket.id}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <TypeBadge type={ticket.type} label={t(`type_${ticket.type}`)} />
                  {ticket.priority === "URGENT" ? (
                    <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-red-300">
                      {t("urgent")}
                    </span>
                  ) : null}
                  <StatusBadge status={ticket.status} label={t(`status_${ticket.status}`)} />
                  {ticket.commentCount > 0 ? (
                    <span className="text-xs text-ink-faint">{t("commentCount", { count: ticket.commentCount })}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-base font-semibold text-ink-main">{ticket.title}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {t("reportedBy", { name: ticket.reporter.name ?? ticket.reporter.email ?? "—" })} ·{" "}
                  {new Date(ticket.createdAt).toLocaleString()}
                  {ticket.area ? ` · ${ticket.area}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!canManage ? <p className="text-xs text-ink-faint">{t("manageHint")}</p> : null}
    </div>
  );
}

function NewTicketForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const t = useTranslations("support");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("BUG");
  const [priority, setPriority] = useState<string>("NORMAL");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          type,
          priority,
          ...(area.trim() ? { area: area.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? String(res.status));
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4 rounded-2xl border border-white/10 bg-dark-100 p-6" onSubmit={submit}>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="t-title">
          {t("fieldTitle")}
        </label>
        <input
          className="w-full rounded-lg border border-white/10 bg-dark-50 px-3 py-2.5 text-sm text-ink-main"
          id="t-title"
          maxLength={160}
          minLength={4}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("fieldTitlePlaceholder")}
          required
          value={title}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="t-type">
            {t("fieldType")}
          </label>
          <select
            className="w-full rounded-lg border border-white/10 bg-dark-50 px-3 py-2.5 text-sm text-ink-main"
            id="t-type"
            onChange={(e) => setType(e.target.value)}
            value={type}
          >
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`type_${ty}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="t-priority">
            {t("fieldPriority")}
          </label>
          <select
            className="w-full rounded-lg border border-white/10 bg-dark-50 px-3 py-2.5 text-sm text-ink-main"
            id="t-priority"
            onChange={(e) => setPriority(e.target.value)}
            value={priority}
          >
            <option value="NORMAL">{t("priorityNormal")}</option>
            <option value="URGENT">{t("priorityUrgent")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="t-area">
            {t("fieldArea")}
          </label>
          <input
            className="w-full rounded-lg border border-white/10 bg-dark-50 px-3 py-2.5 text-sm text-ink-main"
            id="t-area"
            maxLength={120}
            onChange={(e) => setArea(e.target.value)}
            placeholder={t("fieldAreaPlaceholder")}
            value={area}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="t-desc">
          {t("fieldDescription")}
        </label>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-dark-50 px-3 py-2.5 text-sm text-ink-main"
          id="t-desc"
          maxLength={5000}
          minLength={10}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("fieldDescriptionPlaceholder")}
          required
          rows={6}
          value={description}
        />
      </div>

      {/* Attachments need Cloudflare R2, which is not configured on the server
          yet. Say so plainly rather than showing a control that fails. */}
      <p className="rounded-lg border border-white/10 bg-dark-50 p-3 text-xs leading-6 text-ink-soft">
        {t("attachmentsUnavailable")}
      </p>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex gap-3">
        <button className="btn-primary px-5 py-2.5 text-sm" disabled={saving} type="submit">
          {saving ? t("saving") : t("submitTicket")}
        </button>
        <button
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
          onClick={onCancel}
          type="button"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function TypeBadge({ type, label }: { type: Ticket["type"]; label: string }) {
  const tone =
    type === "BUG"
      ? "bg-red-500/15 text-red-300"
      : type === "FEATURE"
        ? "bg-neon-400/15 text-neon-400"
        : "bg-white/10 text-ink-soft";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function StatusBadge({ status, label }: { status: Ticket["status"]; label: string }) {
  const tone =
    status === "OPEN"
      ? "bg-amber-500/15 text-amber-300"
      : status === "IN_PROGRESS"
        ? "bg-blue-500/15 text-blue-300"
        : status === "DONE"
          ? "bg-neon-400/15 text-neon-400"
          : "bg-white/10 text-ink-faint";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}
