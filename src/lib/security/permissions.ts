/**
 * Employee access-control (RBAC) for the Super Admin console.
 *
 * Three layers:
 *  1. `role` (UserRole) — the coarse, stable auth tier (STUDENT/TEACHER/ADMIN).
 *     Untouched by this module; all existing role gates keep working.
 *  2. `accessLevel` (string) — the staff tier layered on top of role=ADMIN.
 *     SUPER_ADMIN sits ABOVE a regular ADMIN. Preset levels seed a default
 *     permission set that the super admin can then fine-tune per employee.
 *  3. `permissions` (string[]) — granular per-module grants ("module.action").
 *
 * Backward compatibility: a legacy ADMIN with accessLevel=null AND
 * permissions=null is treated as UNRESTRICTED (full admin) so nothing regresses.
 * Every employee the super console creates is given an explicit permission set,
 * so employees are always scoped.
 */

import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/security/session";
import { isSuperAdmin as isLegacySuperAdminEmail } from "@/lib/security/superadmin";

// The pure permission catalogue lives in a client-safe module (no IO imports) so
// it can be imported by client components. Re-export it here to keep this the
// single import site for server code.
import { isAccessLevel, type AccessLevel } from "@/lib/security/permission-catalog";

export {
  PERMISSION_MODULES,
  ALL_PERMISSIONS,
  isValidPermission,
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABELS,
  ACCESS_LEVEL_DESCRIPTIONS,
  permissionsForLevel,
  isAccessLevel,
} from "@/lib/security/permission-catalog";
export type { PermissionModule, AccessLevel } from "@/lib/security/permission-catalog";

// ─── Resolved access control for a user ───────────────────────────────────────

export type AccessControl = {
  userId: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  accessLevel: AccessLevel | null;
  /** Super admin: role=ADMIN + (accessLevel SUPER_ADMIN or a legacy super email). */
  isSuper: boolean;
  /** role === ADMIN (any admin tier). */
  isAdmin: boolean;
  /** Legacy full admin (no explicit scoping) or super admin ⇒ can do anything. */
  unrestricted: boolean;
  /** Account deactivated ⇒ no access at all. */
  deactivated: boolean;
  /** Employee must reset their temporary password before normal use. */
  mustChangePassword: boolean;
  permissions: Set<string>;
};

function parsePermissions(value: unknown): Set<string> {
  if (Array.isArray(value)) {
    return new Set(value.filter((p): p is string => typeof p === "string"));
  }
  return new Set();
}

/**
 * Build an AccessControl from raw user fields (already fetched from the DB).
 */
export function buildAccessControl(input: {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  accessLevel: string | null;
  permissions: unknown;
  deactivatedAt: Date | null;
  mustChangePassword?: boolean;
}): AccessControl {
  const isAdmin = input.role === "ADMIN";
  const level = isAccessLevel(input.accessLevel) ? input.accessLevel : null;
  const isSuper =
    isAdmin && (level === "SUPER_ADMIN" || isLegacySuperAdminEmail(input.email));

  // Legacy full admin: an ADMIN with no explicit scoping configured.
  const hasExplicitScope = level !== null || parsePermissions(input.permissions).size > 0;
  const unrestricted = isSuper || (isAdmin && !hasExplicitScope);

  return {
    userId: input.id,
    email: input.email,
    name: input.name,
    role: input.role,
    accessLevel: level,
    isSuper,
    isAdmin,
    unrestricted,
    deactivated: Boolean(input.deactivatedAt),
    mustChangePassword: Boolean(input.mustChangePassword),
    permissions: parsePermissions(input.permissions),
  };
}

/** Does this access control grant the given "module.action" permission? */
export function can(access: AccessControl | null, permission: string): boolean {
  if (!access || access.deactivated) return false;
  if (access.unrestricted) return true;
  return access.permissions.has(permission);
}

/** True only for super admins. */
export function isSuper(access: AccessControl | null): boolean {
  return Boolean(access && !access.deactivated && access.isSuper);
}

// ─── Server-side loaders / guards ─────────────────────────────────────────────

/**
 * Load the CURRENT request's access control, reading the live DB row so that a
 * deactivation or permission change takes effect immediately (not on the next
 * JWT refresh). Returns null if unauthenticated.
 */
export async function getAccessControl(): Promise<AccessControl | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const row = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accessLevel: true,
      permissions: true,
      deactivatedAt: true,
      mustChangePassword: true,
    },
  });

  if (!row) return null;
  return buildAccessControl(row);
}

export class AccessError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "AccessError";
  }
}

/**
 * API-route guard: require super admin. Returns the AccessControl or throws an
 * AccessError the caller converts to a JSON response.
 */
export async function requireSuperAdmin(): Promise<AccessControl> {
  const access = await getAccessControl();
  if (!access) throw new AccessError(401, "Unauthorized");
  // Hard gate: an employee still on their temporary password cannot exercise ANY
  // permission (super included) until they reset it. The change-password flow
  // itself does not go through these guards, so this does not lock them out.
  if (access.mustChangePassword) {
    throw new AccessError(403, "PASSWORD_CHANGE_REQUIRED");
  }
  if (!isSuper(access)) throw new AccessError(403, "Super admin access required");
  return access;
}

/**
 * API-route guard: require a specific permission (super admins always pass).
 */
export async function requirePermission(permission: string): Promise<AccessControl> {
  const access = await getAccessControl();
  if (!access) throw new AccessError(401, "Unauthorized");
  // Hard gate: a temp-password employee cannot exercise any permission until
  // they reset it (see requireSuperAdmin). Enforced before the permission check.
  if (access.mustChangePassword) {
    throw new AccessError(403, "PASSWORD_CHANGE_REQUIRED");
  }
  if (!can(access, permission)) {
    throw new AccessError(403, `Missing permission: ${permission}`);
  }
  return access;
}
