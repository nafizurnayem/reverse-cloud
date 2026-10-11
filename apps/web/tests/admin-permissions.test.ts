import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { visibleAdminSections } from "../src/lib/auth/admin-sections";
import { hasAnyPermission } from "../src/lib/auth/permissions";

let staffAccessFromRows: typeof import("../src/lib/supabase/roles").staffAccessFromRows;

beforeAll(async () => {
  ({ staffAccessFromRows } = await import("../src/lib/supabase/roles"));
});

describe("database staff permissions", () => {
  it("combines active role permissions and ignores unknown permission keys", () => {
    const access = staffAccessFromRows([
      {
        roles: {
          key: "project_manager",
          name: "Project manager",
          role_permissions: [
            { permission_key: "leads.read" },
            { permission_key: "projects.update" },
            { permission_key: "future.permission" },
          ],
        },
      },
      {
        roles: {
          key: "reviewer",
          name: "Reviewer",
          role_permissions: [{ permission_key: "reviews.moderate" }],
        },
      },
    ]);

    expect(access.isStaff).toBe(true);
    expect(access.isAdmin).toBe(false);
    expect(access.roles.map((role) => role.key)).toEqual(["project_manager", "reviewer"]);
    expect(access.permissions).toEqual([
      "leads.read",
      "projects.update",
      "reviews.moderate",
    ]);
  });

  it("recognizes the database admin role without trusting user metadata", () => {
    const access = staffAccessFromRows([
      {
        roles: {
          key: "admin",
          name: "Admin",
          role_permissions: [{ permission_key: "staff.manage" }],
        },
      },
    ]);

    expect(access.isAdmin).toBe(true);
    expect(hasAnyPermission(access, "staff.manage")).toBe(true);
    expect(hasAnyPermission(access, "audit.read")).toBe(false);
  });

  it("shows only sections backed by at least one real permission", () => {
    const sections = visibleAdminSections([
      "reviews.moderate",
      "projects.update",
      "payments.read",
    ]);

    expect(sections.map((section) => section.slug)).toEqual([
      "reviews",
      "projects",
      "payments",
    ]);
  });

  it("fails closed for missing or malformed role rows", () => {
    expect(staffAccessFromRows(null).isStaff).toBe(false);
    expect(staffAccessFromRows([{ roles: { key: "admin" } }]).isStaff).toBe(false);
  });
});
