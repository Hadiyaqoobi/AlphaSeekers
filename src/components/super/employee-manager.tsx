"use client";

import { useCallback, useState } from "react";

import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_DESCRIPTIONS,
  ACCESS_LEVEL_LABELS,
  PERMISSION_MODULES,
  permissionsForLevel,
  type AccessLevel,
} from "@/lib/security/permission-catalog";

/** Serializable employee shape (createdAt is an ISO string across the wire). */
export type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  accessLevel: AccessLevel | null;
  permissions: string[];
  deactivated: boolean;
  createdAt: string;
  createdById: string | null;
};

const MODULE_ENTRIES = Object.entries(PERMISSION_MODULES) as [
  string,
  { label: string; actions: readonly string[] },
][];

const LEVEL_BADGE: Record<AccessLevel, string> = {
  SUPER_ADMIN: "bg-electric-500/10 text-electric-300 border-electric-500/20",
  ADMIN: "bg-neon-500/10 text-neon-300 border-neon-500/20",
  CONTENT_MANAGER: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  FINANCE: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  MODERATOR: "bg-white/5 text-ink-soft border-white/10",
  SUPPORT: "bg-white/5 text-ink-soft border-white/10",
};

type Mode = { kind: "create" } | { kind: "edit"; employee: EmployeeRow };

export function EmployeeManager({
  initialEmployees,
}: {
  initialEmployees: EmployeeRow[];
  /** Accepted for call-site symmetry with the other super console panels; unused here. */
  locale: string;
}) {
  const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees);
  const [mode, setMode] = useState<Mode | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setListError(null);
    try {
      const res = await fetch("/api/super/employees", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load employees (HTTP ${res.status})`);
      const data = (await res.json()) as { employees: EmployeeRow[] };
      setEmployees(data.employees ?? []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to refresh employee list");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const toggleDeactivated = useCallback(
    async (employee: EmployeeRow) => {
      setRowBusy(employee.id);
      setListError(null);
      try {
        const res = await fetch(`/api/super/employees/${employee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deactivated: !employee.deactivated }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || data.message || "Could not update this employee");
        }
        await refresh();
      } catch (err) {
        setListError(err instanceof Error ? err.message : "Could not update this employee");
      } finally {
        setRowBusy(null);
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink-main">Employees</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Staff accounts, their access level and granular permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshing && <span className="text-xs text-ink-faint">Refreshing…</span>}
          <button
            type="button"
            onClick={() => setMode({ kind: "create" })}
            className="inline-flex items-center gap-2 rounded-xl bg-neon-600 px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-neon-500"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add employee
          </button>
        </div>
      </div>

      {listError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {listError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/5 bg-dark-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-ink-soft">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Access level</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-faint">
                    No employees yet. Add your first staff member to get started.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="align-middle hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-main">{emp.name}</p>
                      <p className="text-xs text-ink-soft">{emp.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <LevelBadge level={emp.accessLevel} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-main">
                      {emp.permissions.length}
                    </td>
                    <td className="px-4 py-3">
                      {emp.deactivated ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
                          Deactivated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-500/10 px-2.5 py-1 text-xs font-semibold text-neon-300">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-neon-500" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {new Date(emp.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setMode({ kind: "edit", employee: emp })}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-ink-main transition hover:bg-white/5"
                        >
                          Edit access
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy === emp.id}
                          onClick={() => toggleDeactivated(emp)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            emp.deactivated
                              ? "border-neon-500/30 text-neon-300 hover:bg-neon-500/10"
                              : "border-red-500/30 text-red-300 hover:bg-red-500/10"
                          }`}
                        >
                          {rowBusy === emp.id ? "…" : emp.deactivated ? "Reactivate" : "Deactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mode && (
        <EmployeeModal
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function LevelBadge({ level }: { level: AccessLevel | null }) {
  if (!level) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
        Unrestricted (legacy)
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${LEVEL_BADGE[level]}`}>
      {ACCESS_LEVEL_LABELS[level]}
    </span>
  );
}

// ─── Create / edit modal ────────────────────────────────────────────────────

function EmployeeModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const employee = mode.kind === "edit" ? mode.employee : null;
  const editing = employee !== null;

  // A legacy "unrestricted" admin carries no access level and no explicit grants —
  // it is effectively full-access today. Opening edit will convert it into a scoped
  // account, so we must warn and seed the grid from the full ADMIN preset (never an
  // empty/SUPPORT default, which would silently strip the account to near-zero perms).
  const isLegacyUnrestricted =
    employee !== null && employee.accessLevel === null && employee.permissions.length === 0;

  // Editing pre-fills the level from the employee's current access level (defaulting
  // a legacy unrestricted admin to ADMIN); create defaults to SUPPORT.
  const initialLevel: AccessLevel = employee ? employee.accessLevel ?? "ADMIN" : "SUPPORT";

  const [name, setName] = useState(employee ? employee.name : "");
  const [email, setEmail] = useState(employee ? employee.email : "");
  const [level, setLevel] = useState<AccessLevel>(initialLevel);
  const [perms, setPerms] = useState<Set<string>>(() => {
    // Create: seed from the chosen level's preset.
    if (employee === null) return new Set(permissionsForLevel(initialLevel));
    // Edit a legacy unrestricted admin: preserve broad access with the ADMIN preset.
    if (isLegacyUnrestricted) return new Set(permissionsForLevel("ADMIN"));
    // Edit a scoped account: pre-fill from its CURRENT granular permissions.
    return new Set(employee.permissions);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onSelectLevel = (next: AccessLevel) => {
    setLevel(next);
    // Reseed toggles from the preset; the super admin can still fine-tune.
    setPerms(new Set(permissionsForLevel(next)));
  };

  const togglePerm = (perm: string) => {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const permissions = Array.from(perms);
      if (employee) {
        const res = await fetch(`/api/super/employees/${employee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessLevel: level, permissions }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || "Could not update access");
        await onSaved();
        onClose();
      } else {
        const res = await fetch("/api/super/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, accessLevel: level, permissions }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || "Could not create employee");
        setTempPassword(String(data.tempPassword ?? ""));
        await onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="my-4 w-full max-w-2xl rounded-2xl border border-white/10 bg-dark-100 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-ink-main">
              {tempPassword ? "Employee created" : editing ? "Edit access" : "Add employee"}
            </h3>
            <p className="mt-0.5 text-sm text-ink-soft">
              {tempPassword
                ? "Share the temporary password securely — it is shown only once."
                : employee
                  ? `${employee.name} · ${employee.email}`
                  : "Provision a scoped staff account with a preset access level."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-faint transition hover:bg-white/5 hover:text-ink-soft"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {tempPassword ? (
          <div className="space-y-4 px-6 py-6">
            <div className="rounded-xl border border-neon-500/20 bg-neon-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-neon-300">
                One-time temporary password
              </p>
              <div className="mt-2 flex items-center gap-3">
                <code className="flex-1 select-all break-all rounded-lg border border-neon-500/20 bg-dark-200 px-3 py-2 font-mono text-sm text-ink-main">
                  {tempPassword}
                </code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="shrink-0 rounded-lg bg-neon-600 px-3 py-2 text-xs font-semibold text-black transition hover:bg-neon-500"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-xs text-neon-300">
                The employee must change this password on first login. It cannot be retrieved again — if lost,
                reset access from this console.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 px-6 py-6">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
                {error}
              </div>
            )}

            {isLegacyUnrestricted && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300" role="alert">
                <span className="font-semibold">Heads up:</span> This is a legacy unrestricted admin with full
                access and no scoped permissions. Saving converts them into a scoped account limited to the
                permissions selected below. The grid has been pre-filled with the full Admin preset to preserve
                their access — adjust it before saving if you want to narrow it.
              </div>
            )}

            {/* Identity */}
            {employee ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-soft">
                Editing access for <span className="font-semibold text-ink-main">{employee.name}</span>.
                Name and email are managed on the account itself.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-ink-main">Full name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-dark-200 px-3 py-2 text-sm text-ink-main placeholder-ink-faint outline-none focus:border-neon-500 focus:ring-2 focus:ring-neon-500/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink-main">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@alphaseekers.org"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-dark-200 px-3 py-2 text-sm text-ink-main placeholder-ink-faint outline-none focus:border-neon-500 focus:ring-2 focus:ring-neon-500/20"
                  />
                </label>
              </div>
            )}

            {/* Access level */}
            <div>
              <label className="block">
                <span className="text-sm font-medium text-ink-main">Access level</span>
                <select
                  value={level}
                  onChange={(e) => onSelectLevel(e.target.value as AccessLevel)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-dark-200 px-3 py-2 text-sm text-ink-main outline-none focus:border-neon-500 focus:ring-2 focus:ring-neon-500/20"
                >
                  {ACCESS_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {ACCESS_LEVEL_LABELS[lvl]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-ink-soft">{ACCESS_LEVEL_DESCRIPTIONS[level]}</p>
              <p className="mt-1 text-xs text-ink-faint">
                Choosing a level resets the toggles below to its defaults — fine-tune individual permissions
                afterwards.
              </p>
            </div>

            {/* Permission toggle grid */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-main">Permissions</span>
                <span className="text-xs text-ink-faint">{perms.size} selected</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {MODULE_ENTRIES.map(([moduleKey, def]) => (
                  <fieldset key={moduleKey} className="rounded-xl border border-white/10 p-3">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                      {def.label}
                    </legend>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                      {def.actions.map((action) => {
                        const perm = `${moduleKey}.${action}`;
                        const checked = perms.has(perm);
                        return (
                          <label key={perm} className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-main">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePerm(perm)}
                              className="h-4 w-4 rounded border-white/20 text-neon-600 focus:ring-neon-500/30"
                            />
                            <span className="capitalize">{action}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer (hidden on the success screen, which has its own Done) */}
        {!tempPassword && (
          <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-ink-main transition hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || (!editing && (!name.trim() || !email.trim()))}
              className="rounded-xl bg-neon-600 px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition hover:bg-neon-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Saving…" : editing ? "Save access" : "Create employee"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
