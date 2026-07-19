# ADR-0002 — Three-layer Super Admin access-control model

- **Status:** Accepted (implemented)
- **Date:** 2026-07-18
- **Deciders:** Platform engineering
- **Related:** `src/lib/security/permissions.ts`,
  `src/lib/security/permission-catalog.ts`, `src/lib/platform/super-store.ts`,
  `src/app/[locale]/super/*`, `src/app/api/super/*`, `prisma/schema.prisma`

## Context

The platform had exactly one privilege tier above a normal user: `role = ADMIN`,
checked with a flat `user.role !== "ADMIN"` guard on each admin route. That is
too coarse for an operations team: a content moderator, a finance/analytics
viewer, and a full platform owner all had to be the same all-powerful admin, and
there was no way to provision a scoped employee, no immediate deactivation, and
no audit of privileged actions.

We needed to add fine-grained staff scoping **without breaking any existing
admin** and without a risky data migration on a live user table. Three
constraints shaped the design:

- **No regression.** Every account that is an admin today must keep working
  exactly as before on day one.
- **Immediate effect.** Deactivating an employee or narrowing their access must
  take effect without waiting for a 7-day JWT to expire.
- **Client-safe catalog.** The employee-management UI must render an access-level
  picker and a permission grid, so the catalog of modules/levels must be
  importable by client components (no server-only IO imports).

## Decision

**Introduce a three-layer model that layers staff authorization on top of the
unchanged `role`, defaulting legacy admins to unrestricted, and resolve it from
the live database row on every request.**

- **Layer 1 — `role` (`UserRole` enum).** Unchanged. Remains the stable coarse
  auth tier; all existing role gates keep working.
- **Layer 2 — `accessLevel` (nullable string on `User`).** A staff tier that is
  only meaningful on `role = ADMIN`: `SUPER_ADMIN` > `ADMIN` >
  `CONTENT_MANAGER` / `FINANCE` / `MODERATOR` / `SUPPORT`. Each preset seeds a
  default permission set (`permissionsForLevel`, `permission-catalog.ts:90-118`).
- **Layer 3 — `permissions` (JSON `string[]` of `"module.action"`).** Granular
  grants enforced by `can()`.

New nullable columns on `User` (`schema.prisma:75-84`): `accessLevel`,
`permissions`, `deactivatedAt`, `mustChangePassword`, `createdById` — all nullable
/ defaulted, so the migration is additive and touches no existing rows'
behavior.

**Backward-compat rule** (`buildAccessControl`, `permissions.ts:82-103`):

```
unrestricted = isSuper || (isAdmin && !hasExplicitScope)
hasExplicitScope = accessLevel != null || permissions.size > 0
```

A legacy admin (`accessLevel = null`, `permissions = null`) has no explicit
scope, so it is **unrestricted** — `can()` returns `true` for everything, exactly
as before. Every employee the super console creates is given an explicit
`accessLevel` + `permissions` (`super-store.ts:141-165`), so it is always scoped.

**Live resolution** (`getAccessControl`, `permissions.ts:125-145`) reads
`role, accessLevel, permissions, deactivatedAt, mustChangePassword` from the DB
per request, so a deactivation or grant change takes effect on the employee's
next request — not their next login. `deactivated` is a hard stop in `can()` and
`isSuper()`.

**Separation of concerns:** the pure catalog (`permission-catalog.ts`) has no IO
imports and is safe for client components; the IO-bound guards
(`getAccessControl`, `requirePermission`, `requireSuperAdmin`) live in
`permissions.ts`, which re-exports the catalog as the single server import site.

**Provisioning & safety** (`super-store.ts`): employees are created as
`role = ADMIN` with a 12-char url-safe temp password and `mustChangePassword =
true`; the last active `SUPER_ADMIN` can be neither demoted nor deactivated
(`super-store.ts:198-231`); privileged actions are written to the audit log.

## Consequences

**Positive**

- Zero-migration backward compatibility, proven by `tests/rbac.test.ts` ("legacy
  admins remain unrestricted").
- Fine-grained least-privilege staffing (moderator, finance, support, content).
- Immediate deactivation / re-scoping because authorization reads the live row.
- Existing admin routes were retrofitted with `requirePermission()` guards
  (e.g. `admin/users/[id]/route.ts:13` requires `users.approve`), so the model is
  actually enforced, not just declarative.
- A client-safe catalog keeps the UI and the guards in sync from one source.

**Negative / trade-offs**

- `getAccessControl()` adds **one indexed `User` lookup per authorized request**.
  This is the deliberate cost of immediate revocation; it is a single-row
  primary-key read and the `User` table is indexed on `role`/`accessLevel`. If it
  ever shows up in profiling, a short per-request memo or a `tokenVersion` column
  compared against the JWT are the escalation paths.
- Permissions live in a JSON column, not a normalized `Permission` table.
  Adequate at this scale and keeps grants co-located with the user; a normalized
  model would be warranted only if permissions needed their own lifecycle/queries.
- A configured legacy super-admin email allowlist (`superadmin.ts`) is honored
  in addition to `accessLevel = SUPER_ADMIN`. Convenient for bootstrapping, but
  it is a second source of truth and should be retired once seeded super admins
  exist in the DB.

## Alternatives considered

1. **A new `role` value (e.g. `SUPER_ADMIN`) instead of a layered `accessLevel`.**
   Rejected: it would fork every existing `role === "ADMIN"` check and force a
   data migration of live rows; the layered design leaves `role` untouched.
2. **Encode permissions in the JWT.** Rejected: it defeats immediate revocation —
   a scoped-down or deactivated employee would keep their old grants until the
   token refreshed. Live DB resolution is the whole point.
3. **Normalized `Permission` / `RolePermission` tables.** Deferred: more moving
   parts than warranted for a fixed, small catalog; the JSON column plus a
   validated catalog gives the same safety with less machinery.
