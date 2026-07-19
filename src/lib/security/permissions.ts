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

// ─── Permission catalogue ─────────────────────────────────────────────────────

export const PERMISSION_MODULES = {
  users: {
    label: "Users",
    actions: ["view", "create", "edit", "delete", "approve"],
  },
  classes: {
    label: "Classes",
    actions: ["view", "create", "edit", "delete"],
  },
  content: {
    label: "Content & Stories",
    actions: ["view", "create", "edit", "moderate", "delete"],
  },
  library: {
    label: "Library",
    actions: ["view", "edit"],
  },
  opportunities: {
    label: "Opportunities & Webinars",
    actions: ["view", "edit"],
  },
  analytics: {
    label: "Analytics & KPIs",
    actions: ["view"],
  },
  ai: {
    label: "AI Tools",
    actions: ["use", "manage"],
  },
  system: {
    label: "System",
    actions: ["audit", "settings", "employees"],
  },
} as const;

export type PermissionModule = keyof typeof PERMISSION_MODULES;

/** Every valid "module.action" permission string. */
export const ALL_PERMISSIONS: string[] = Object.entries(PERMISSION_MODULES).flatMap(
  ([mod, def]) => def.actions.map((a) => `${mod}.${a}`),
);

export function isValidPermission(perm: string): boolean {
  return ALL_PERMISSIONS.includes(perm);
}

// ─── Access levels (presets) ──────────────────────────────────────────────────

export const ACCESS_LEVELS = [
  "SUPER_ADMIN",
  "ADMIN",
  "CONTENT_MANAGER",
  "FINANCE",
  "MODERATOR",
  "SUPPORT",
] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  CONTENT_MANAGER: "Content Manager",
  FINANCE: "Finance / Analytics",
  MODERATOR: "Moderator",
  SUPPORT: "Support",
};

export const ACCESS_LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  SUPER_ADMIN: "Full control of everything, including managing employees and their access.",
  ADMIN: "Full admin powers across the platform (cannot manage employees or super-admin tools).",
  CONTENT_MANAGER: "Manage stories, library and course content; view classes and analytics.",
  FINANCE: "View analytics, KPIs and user records (read-only).",
  MODERATOR: "Review and moderate community content; view users.",
  SUPPORT: "Read-only access to users, classes and analytics to assist learners.",
};

/** Default permission set seeded when a level is chosen. Refine per-employee. */
export function permissionsForLevel(level: AccessLevel): string[] {
  switch (level) {
    case "SUPER_ADMIN":
      return [...ALL_PERMISSIONS];
    case "ADMIN":
      // Everything except the super-only system.employees capability.
      return ALL_PERMISSIONS.filter((p) => p !== "system.employees");
    case "CONTENT_MANAGER":
      return [
        "content.view",
        "content.create",
        "content.edit",
        "content.moderate",
        "content.delete",
        "library.view",
        "library.edit",
        "classes.view",
        "analytics.view",
      ];
    case "FINANCE":
      return ["analytics.view", "users.view"];
    case "MODERATOR":
      return ["content.view", "content.moderate", "content.delete", "users.view"];
    case "SUPPORT":
      return ["users.view", "classes.view", "analytics.view"];
    default:
      return [];
  }
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "string" && (ACCESS_LEVELS as readonly string[]).includes(value);
}

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
  if (!isSuper(access)) throw new AccessError(403, "Super admin access required");
  return access;
}

/**
 * API-route guard: require a specific permission (super admins always pass).
 */
export async function requirePermission(permission: string): Promise<AccessControl> {
  const access = await getAccessControl();
  if (!access) throw new AccessError(401, "Unauthorized");
  if (!can(access, permission)) {
    throw new AccessError(403, `Missing permission: ${permission}`);
  }
  return access;
}
