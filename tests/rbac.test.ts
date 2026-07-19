/**
 * Unit tests for the Super Admin RBAC core (src/lib/security/permissions.ts).
 *
 * The IO-bound modules (prisma, session) are mocked so we exercise the pure
 * authorization logic in isolation — this is the security-critical heart of the
 * employee/access-level feature, so it is tested exhaustively.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/security/session", () => ({ getSessionUser: vi.fn() }));

import {
  ALL_PERMISSIONS,
  buildAccessControl,
  can,
  isSuper,
  isValidPermission,
  permissionsForLevel,
} from "@/lib/security/permissions";

function base(overrides: Partial<Parameters<typeof buildAccessControl>[0]> = {}) {
  return buildAccessControl({
    id: "u1",
    email: "person@example.com",
    name: "Person",
    role: "ADMIN",
    accessLevel: null,
    permissions: null,
    deactivatedAt: null,
    mustChangePassword: false,
    ...overrides,
  });
}

describe("permission catalogue", () => {
  it("every level preset yields only valid permissions", () => {
    for (const level of ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER", "FINANCE", "MODERATOR", "SUPPORT"] as const) {
      for (const p of permissionsForLevel(level)) {
        expect(isValidPermission(p)).toBe(true);
      }
    }
  });

  it("SUPER_ADMIN preset grants the full permission set", () => {
    expect(permissionsForLevel("SUPER_ADMIN").sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it("ADMIN preset grants everything except system.employees", () => {
    const admin = permissionsForLevel("ADMIN");
    expect(admin).not.toContain("system.employees");
    expect(admin).toContain("users.delete");
    expect(admin).toContain("analytics.view");
  });
});

describe("legacy admins remain unrestricted (no regression)", () => {
  it("an ADMIN with no accessLevel and no permissions can do anything", () => {
    const a = base({ accessLevel: null, permissions: null });
    expect(a.unrestricted).toBe(true);
    expect(can(a, "users.delete")).toBe(true);
    expect(can(a, "system.settings")).toBe(true);
    expect(can(a, "content.moderate")).toBe(true);
  });
});

describe("scoped employees are limited to their grants", () => {
  const emp = base({
    accessLevel: "SUPPORT",
    permissions: ["users.view", "classes.view", "analytics.view"],
  });

  it("is not unrestricted and not super", () => {
    expect(emp.unrestricted).toBe(false);
    expect(isSuper(emp)).toBe(false);
  });

  it("allows granted permissions", () => {
    expect(can(emp, "users.view")).toBe(true);
    expect(can(emp, "analytics.view")).toBe(true);
  });

  it("denies non-granted permissions", () => {
    expect(can(emp, "users.delete")).toBe(false);
    expect(can(emp, "content.moderate")).toBe(false);
    expect(can(emp, "system.employees")).toBe(false);
  });
});

describe("super admins", () => {
  it("accessLevel SUPER_ADMIN ⇒ isSuper and can do everything", () => {
    const s = base({ accessLevel: "SUPER_ADMIN", permissions: ["users.view"] });
    expect(isSuper(s)).toBe(true);
    expect(s.unrestricted).toBe(true);
    expect(can(s, "system.employees")).toBe(true);
    expect(can(s, "anything.at.all")).toBe(true);
  });

  it("legacy super-admin email is honored even without an accessLevel", () => {
    const s = base({ email: "hadiyaqoobi@gmail.com", accessLevel: null, permissions: null });
    expect(isSuper(s)).toBe(true);
  });

  it("a non-admin (student) is never super and can do nothing", () => {
    const student = base({ role: "STUDENT", accessLevel: null, permissions: null });
    expect(isSuper(student)).toBe(false);
    expect(student.unrestricted).toBe(false);
    expect(can(student, "users.view")).toBe(false);
  });
});

describe("deactivation is a hard stop", () => {
  it("a deactivated employee can do nothing, even with permissions", () => {
    const d = base({
      accessLevel: "CONTENT_MANAGER",
      permissions: ["content.view", "content.edit"],
      deactivatedAt: new Date(),
    });
    expect(can(d, "content.view")).toBe(false);
    expect(isSuper(d)).toBe(false);
  });

  it("a deactivated super admin loses super access", () => {
    const d = base({ accessLevel: "SUPER_ADMIN", deactivatedAt: new Date() });
    expect(isSuper(d)).toBe(false);
    expect(can(d, "users.view")).toBe(false);
  });
});

describe("null-safety", () => {
  it("can(null, ...) is false", () => {
    expect(can(null, "users.view")).toBe(false);
    expect(isSuper(null)).toBe(false);
  });
});
