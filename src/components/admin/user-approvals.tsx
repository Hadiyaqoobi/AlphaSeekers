"use client";

import { useEffect, useMemo, useState } from "react";

import { useTranslations } from "next-intl";

type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  /** What they picked at signup. Null on accounts predating the field. */
  requestedRole: UserRole | null;
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

// TEACHER_REQUESTS: applied to teach, still a STUDENT. Registration approves
// everyone automatically, so these never appear under PENDING.
type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "TEACHER_REQUESTS";
type RoleFilter = UserRole | "ALL";

const STATUS_FILTERS: StatusFilter[] = ["ALL", "PENDING", "APPROVED", "TEACHER_REQUESTS"];
const ROLE_FILTERS: RoleFilter[] = ["ALL", "STUDENT", "TEACHER", "ADMIN"];
const ASSIGNABLE_ROLES: UserRole[] = ["STUDENT", "TEACHER", "ADMIN"];

export function UserApprovals() {
  const t = useTranslations("adminForms");
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  // What is typed vs. what was searched for. Searching only on submit: the list
  // used to re-query on every keystroke AND again when Search was pressed.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // Default ALL: registration approves everyone, so a PENDING default opened on
  // an empty list and hid teacher applicants entirely.
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // A role change waits here until confirmed: the dropdown used to apply the
  // instant it changed, so a mis-click promoted or demoted someone.
  const [pendingRole, setPendingRole] = useState<{ userId: string; role: UserRole } | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("role", status === "TEACHER_REQUESTS" ? "ALL" : roleFilter);
    params.set("page", String(page));
    params.set("limit", "10");
    if (search.trim()) {
      params.set("search", search.trim());
    }
    return params.toString();
  }, [page, search, status, roleFilter]);

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

    const updated = (await response.json()) as AdminUserItem;

    // Only drop the row when it no longer matches the active filter. Under
    // APPROVED/ALL the freshly approved user still belongs on screen.
    if (status === "PENDING") {
      setItems((current) => current.filter((item) => item.id !== userId));
      setSelected((current) => { const next = new Set(current); next.delete(userId); return next; });
    } else {
      setItems((current) => current.map((item) => (item.id === userId ? { ...item, ...updated } : item)));
    }

    setMessage(t("approved"));
  }

  async function changeRole(userId: string, role: UserRole) {
    setMessage(null);
    setBusyId(userId);
    setPendingRole(null);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("roleChangeFailed") }))) as { message?: string };
      setMessage(body.message ?? t("roleChangeFailed"));
      setBusyId(null);
      return;
    }

    const updated = (await response.json()) as AdminUserItem;

    const leavesView =
      (status === "TEACHER_REQUESTS" && updated.role !== "STUDENT") ||
      (status !== "TEACHER_REQUESTS" && roleFilter !== "ALL" && updated.role !== roleFilter);
    if (leavesView) {
      setItems((current) => current.filter((item) => item.id !== userId));
    } else {
      setItems((current) => current.map((item) => (item.id === userId ? { ...item, role: updated.role } : item)));
    }

    setMessage(t("roleChanged", { role: updated.role }));
    setBusyId(null);
  }

  /** Decline a teacher request: they stay a student, and stop being flagged. */
  async function declineRequest(userId: string) {
    setMessage(null);
    setBusyId(userId);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedRole: null }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("roleChangeFailed") }))) as { message?: string };
      setMessage(body.message ?? t("roleChangeFailed"));
      setBusyId(null);
      return;
    }

    if (status === "TEACHER_REQUESTS") {
      setItems((current) => current.filter((item) => item.id !== userId));
    } else {
      setItems((current) => current.map((item) => (item.id === userId ? { ...item, requestedRole: null } : item)));
    }

    setMessage(t("requestDeclined"));
    setBusyId(null);
  }

  async function deleteUser(userId: string) {
    setMessage(null);
    setBusyId(userId);

    const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: t("deleteFailed") }))) as {
        message?: string;
        blockers?: { teachingClasses: string[]; uploadedMaterials: number };
      };

      // A 409 carries the reason (classes/materials still owned). Surface it —
      // "delete failed" alone gives the admin nothing to act on.
      if (response.status === 409 && body.blockers) {
        const parts: string[] = [];
        if (body.blockers.teachingClasses.length > 0) {
          parts.push(`${t("blockerClasses")}: ${body.blockers.teachingClasses.join(", ")}`);
        }
        if (body.blockers.uploadedMaterials > 0) {
          parts.push(`${t("blockerMaterials")}: ${body.blockers.uploadedMaterials}`);
        }
        setMessage(`${body.message ?? t("deleteFailed")} ${parts.join(" · ")}`);
      } else {
        setMessage(body.message ?? t("deleteFailed"));
      }

      setBusyId(null);
      setConfirmDeleteId(null);
      return;
    }

    setItems((current) => current.filter((item) => item.id !== userId));
    setSelected((current) => { const next = new Set(current); next.delete(userId); return next; });
    setMessage(t("userDeleted"));
    setBusyId(null);
    setConfirmDeleteId(null);
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

    setSelected(new Set());
    setMessage(`${approved} ${t("approved")}`);
    setBulkApproving(false);
    await load();
  }

  return (
    <section className="panel panel-strong space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-black text-ink-main">{t("manageUsers")}</h2>
          <p className="text-sm text-ink-soft">{t("manageUsersSubtitle")}</p>
        </div>
        <button className="btn-secondary" disabled={loading} onClick={load} type="button">
          {loading ? "..." : t("refresh")}
        </button>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = searchInput.trim();
          // Unchanged query + first page: the effect will not fire, so reload
          // explicitly. Otherwise the state change triggers exactly one load.
          if (next === search && page === 1) {
            load();
          } else {
            setPage(1);
            setSearch(next);
          }
        }}
      >
        <input
          className="field min-w-[220px] flex-1"
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t("searchPlaceholder")}
          value={searchInput}
        />
        <select
          aria-label={t("filterStatus")}
          className="field"
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as StatusFilter);
          }}
          value={status}
        >
          {STATUS_FILTERS.map((value) => (
            <option key={value} value={value}>
              {t(`status${value}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filterRole")}
          className="field"
          disabled={status === "TEACHER_REQUESTS"}
          onChange={(event) => {
            setPage(1);
            setRoleFilter(event.target.value as RoleFilter);
          }}
          value={roleFilter}
        >
          {ROLE_FILTERS.map((value) => (
            <option key={value} value={value}>
              {t(`role${value}`)}
            </option>
          ))}
        </select>
        <button className="btn-primary" disabled={loading} type="submit">
          {t("search")}
        </button>
      </form>

      {selected.size > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-neon-500/20 bg-neon-500/10 px-3 py-2">
          <p className="text-sm font-medium text-neon-300">{selected.size} selected</p>
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
        <p className="text-sm text-ink-soft">{t("noUsers")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-soft">
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
                  <td className="py-2 font-semibold text-ink-main">
                    {item.name}
                    {/* Registration always creates a STUDENT, so an applicant who
                        chose Teacher looks identical to a learner without this.
                        Deliberately narrow: an "any mismatch" test would put a
                        Grant button on every student later promoted to teacher —
                        their signup choice stays STUDENT forever — and clicking it
                        would silently DEMOTE them. Only an ungranted upgrade counts. */}
                    {item.requestedRole === "TEACHER" && item.role === "STUDENT" ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                        {t("requestedRole", { role: t(`role${item.requestedRole}`) })}
                        <button
                          className="underline decoration-dotted underline-offset-2 hover:text-amber-200 disabled:opacity-50"
                          disabled={busyId === item.id}
                          onClick={() => setPendingRole({ userId: item.id, role: "TEACHER" })}
                          type="button"
                        >
                          {t("grantRequested")}
                        </button>
                        <button
                          className="underline decoration-dotted underline-offset-2 hover:text-amber-200 disabled:opacity-50"
                          disabled={busyId === item.id}
                          onClick={() => declineRequest(item.id)}
                          type="button"
                        >
                          {t("declineRequest")}
                        </button>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <select
                      aria-label={`${t("role")} — ${item.name}`}
                      className="field py-1 text-xs"
                      disabled={busyId === item.id}
                      onChange={(event) => {
                        const role = event.target.value as UserRole;
                        setPendingRole(role === item.role ? null : { userId: item.id, role });
                      }}
                      value={pendingRole?.userId === item.id ? pendingRole.role : item.role}
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`role${role}`)}
                        </option>
                      ))}
                    </select>
                    {pendingRole?.userId === item.id ? (
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-amber-300">
                          {t("confirmRoleChange", { role: t(`role${pendingRole.role}`) })}
                        </span>
                        <button
                          className="btn-primary px-2.5 py-1 text-xs"
                          disabled={busyId === item.id}
                          onClick={() => changeRole(item.id, pendingRole.role)}
                          type="button"
                        >
                          {busyId === item.id ? "..." : t("confirmRoleYes")}
                        </button>
                        <button
                          className="btn-secondary px-2.5 py-1 text-xs"
                          onClick={() => setPendingRole(null)}
                          type="button"
                        >
                          {t("cancel")}
                        </button>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2">{item.email}</td>
                  <td className="py-2">{item.phone ?? "-"}</td>
                  <td className="py-2">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {item.approvedAt ? (
                        <span className="text-xs text-ink-faint">{t("approvedLabel")}</span>
                      ) : (
                        <button className="btn-primary" onClick={() => approve(item.id)} type="button">
                          {t("approve")}
                        </button>
                      )}

                      {confirmDeleteId === item.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-red-300">{t("deleteConfirm")}</span>
                          <button
                            className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                            disabled={busyId === item.id}
                            onClick={() => deleteUser(item.id)}
                            type="button"
                          >
                            {busyId === item.id ? "..." : t("deleteYes")}
                          </button>
                          <button
                            className="btn-secondary px-2.5 py-1 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                            type="button"
                          >
                            {t("cancel")}
                          </button>
                        </span>
                      ) : (
                        <button
                          className="rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                          onClick={() => setConfirmDeleteId(item.id)}
                          type="button"
                        >
                          {t("delete")}
                        </button>
                      )}
                    </div>
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
            {/* "pending" is only true of the PENDING view; the others count users. */}
            {status === "PENDING"
              ? t("pageInfo", { current: pagination.page, total: pagination.totalPages, count: pagination.totalItems })
              : t("pageInfoTotal", { current: pagination.page, total: pagination.totalPages, count: pagination.totalItems })}
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
