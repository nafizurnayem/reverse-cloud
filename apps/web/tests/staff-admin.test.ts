import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { setStaffRoleStatus } from "../src/app/[locale]/admin/staff/actions";
import { staffRoleStatusPayload } from "../src/lib/admin/staff-values";

const userId = "00000000-0000-4000-8000-000000002701";
const roleId = "00000000-0000-4000-8000-000000002702";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.requirePermission.mockResolvedValue({ supabase: { rpc: mocks.rpc } });
});

describe("staff role input", () => {
  it("accepts UUIDs and an explicit boolean status", () => {
    expect(staffRoleStatusPayload(form({ user_id: userId, role_id: roleId, is_active: "true" })))
      .toEqual({ userId, roleId, isActive: true });
  });

  it("rejects malformed IDs and ambiguous status values", () => {
    expect(staffRoleStatusPayload(form({ user_id: "someone", role_id: roleId, is_active: "yes" })))
      .toBeNull();
  });
});

describe("staff role action", () => {
  it("requires staff.manage and activates through the atomic RPC", async () => {
    const data = form({ locale: "bn", user_id: userId, role_id: roleId, is_active: "true" });
    await expect(setStaffRoleStatus(data)).rejects.toThrow(
      "redirect:/bn/admin/staff?saved=activated",
    );
    expect(mocks.requirePermission).toHaveBeenCalledWith("bn", "staff.manage");
    expect(mocks.rpc).toHaveBeenCalledWith("set_staff_role_status", {
      p_user_id: userId,
      p_role_id: roleId,
      p_is_active: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/bn/admin/staff");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/bn/admin", "layout");
  });

  it("rejects invalid input before calling the database", async () => {
    const data = form({ locale: "en", user_id: "bad", role_id: roleId, is_active: "false" });
    await expect(setStaffRoleStatus(data)).rejects.toThrow(
      "redirect:/en/admin/staff?error=invalidInput",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("turns final-admin protection into a stable localized error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "last_active_admin" } });
    const data = form({ locale: "en", user_id: userId, role_id: roleId, is_active: "false" });
    await expect(setStaffRoleStatus(data)).rejects.toThrow(
      "redirect:/en/admin/staff?error=lastActiveAdmin",
    );
  });
});
