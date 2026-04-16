"use client";

import { useEffect, useMemo, useState } from "react";

import { useTranslations } from "next-intl";

type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  approvedAt: string | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

type AdminUsersResponse = {
  items: AdminUserItem[];
  pagination: Pagination;
};

export function UserApprovals() {
  const t = useTranslations("adminForms");
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", "PENDING");
    params.set("page", String(page));
    params.set("limit", "10");
    if (search.trim()) {
      params.set("search", search.trim());
    }
    return params.toString();
  }, [page, search]);

  async function load() {
    setLoading(true);
    setMessage(null);

    const response = await fetch(`/api/admin/users?${queryString}`, { cache: "no-store" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("loadFailed") }))) as { message?: string };
      setMessage(body.message ?? t("loadFailed"));
      setLoading(false);
      return;
    }

    const body = (await response.json()) as AdminUsersResponse;
    setItems(body.items);
    setPagination(body.pagination);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  async function approve(userId: string) {
    setMessage(null);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ approved: true }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("approvalFailed") }))) as { message?: string };
      setMessage(body.message ?? t("approvalFailed"));
      return;
    }

    setItems((current) => current.filter((item) => item.id !== userId));
    setSelected((current) => { const next = new Set(current); next.delete(userId); return next; });
    setMessage(t("approved"));
  }

  function toggleSelect(userId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function bulkApprove() {
    if (selected.size === 0) return;
    setBulkApproving(true);
    setMessage(null);

    const ids = Array.from(selected);
    let approved = 0;
    for (const userId of ids) {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      });
      if (response.ok) approved++;
    }

    setItems((current) => current.filter((item) => !selected.has(item.id)));
    setSelected(new Set());
    setMessage(`${approved} ${t("approved")}`);
    setBulkApproving(false);
  }

  return (
    <section className="panel panel-strong space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-black text-ink-main">{t("pendingApprovals")}</h2>
          <p className="text-sm text-ink-soft">{t("approvalSubtitle")}</p>
        </div>
        <button className="btn-secondary" disabled={loading} onClick={load} type="button">
          {loading ? "..." : t("refresh")}
        </button>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          load();
        }}
      >
        <input
          className="field min-w-[220px] flex-1"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchPlaceholder")}
          value={search}
        />
        <button className="btn-primary" disabled={loading} type="submit">
          {t("search")}
        </button>
      </form>

      {selected.size > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-neon-200 bg-neon-50 px-3 py-2">
          <p className="text-sm font-medium text-neon-900">{selected.size} selected</p>
          <button
            className="btn-primary"
            disabled={bulkApproving}
            onClick={bulkApprove}
            type="button"
          >
            {bulkApproving ? "..." : `${t("approve")} (${selected.size})`}
          </button>
        </div>
      ) : null}

      {message ? <p className="text-sm text-ink-main">{message}</p> : null}

      {loading ? <p className="text-sm text-ink-soft">{t("loading")}</p> : null}

      {!loading && items.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("noPending")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-DEFAULT text-ink-soft">
                <th className="py-2 w-8" scope="col">
                  <input
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={toggleSelectAll}
                    type="checkbox"
                  />
                </th>
                <th className="py-2 font-semibold" scope="col">{t("name")}</th>
                <th className="py-2 font-semibold" scope="col">{t("role")}</th>
                <th className="py-2 font-semibold" scope="col">{t("email")}</th>
                <th className="py-2 font-semibold" scope="col">{t("phone")}</th>
                <th className="py-2 font-semibold" scope="col">{t("created")}</th>
                <th className="py-2 text-right font-semibold" scope="col">{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-b border-line-soft text-ink-main" key={item.id}>
                  <td className="py-2 w-8">
                    <input
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="py-2 font-semibold text-ink-main">{item.name}</td>
                  <td className="py-2">{item.role}</td>
                  <td className="py-2">{item.email}</td>
                  <td className="py-2">{item.phone ?? "-"}</td>
                  <td className="py-2">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <button className="btn-primary" onClick={() => approve(item.id)} type="button">
                      {t("approve")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="btn-secondary"
            disabled={loading || pagination.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            {t("prev")}
          </button>
          <p className="text-sm font-semibold text-ink-main">
            {t("pageInfo", { current: pagination.page, total: pagination.totalPages, count: pagination.totalItems })}
          </p>
          <button
            className="btn-secondary"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
            type="button"
          >
            {t("next")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
