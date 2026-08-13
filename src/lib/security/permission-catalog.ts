/**
 * Pure RBAC catalogue — permission modules, access levels, and their presets.
 *
 * This module has NO IO dependencies (no prisma, no session, no next-auth) so it
 * is safe to import from client components (the employee-management UI needs the
 * catalogue to render the access-level picker and permission toggle grid). The
 * IO-bound guards live in ./permissions.ts, which re-exports everything here.
 */

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
  support: {
    label: "Support Tickets",
    // create = file a ticket; view = see the queue; manage = change status.
    actions: ["view", "create", "manage"],
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

// Anyone with admin access must be able to report a problem, whatever else
// their level restricts. Only full admins get to change a ticket's status.
const SUPPORT_REPORTER = ["support.view", "support.create"];

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
        ...SUPPORT_REPORTER,
      ];
    case "FINANCE":
      return ["analytics.view", "users.view", ...SUPPORT_REPORTER];
    case "MODERATOR":
      return ["content.view", "content.moderate", "content.delete", "users.view", ...SUPPORT_REPORTER];
    case "SUPPORT":
      return ["users.view", "classes.view", "analytics.view", ...SUPPORT_REPORTER];
    default:
      return [];
  }
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "string" && (ACCESS_LEVELS as readonly string[]).includes(value);
}
