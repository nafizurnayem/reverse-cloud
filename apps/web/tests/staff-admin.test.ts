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

import {
  addStaffMember,
  revokeStaffInvite,
  setStaffRoleStatus,
} from "../src/app/[locale]/admin/staff/actions";
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
  it("looks up an exact email and activates the selected role", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [{ user_id: userId, email: "person@example.com", full_name: "Person" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const data = form({
      locale: "en",
      email: " Person@Example.com ",
      role_id: roleId,
    });

    await expect(addStaffMember(data)).rejects.toThrow(
      "redirect:/en/admin/staff?saved=added",
    );
    expect(mocks.requirePermission).toHaveBeenCalledWith("en", "staff.manage");
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "lookup_user_by_email", {
      p_email: "person@example.com",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "set_staff_role_status", {
      p_user_id: userId,
      p_role_id: roleId,
      p_is_active: true,
    });
  });

  it("pre-authorizes the email when no signed-in account exists yet", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: { status: "preauthorized" }, error: null });
    const data = form({ locale: "en", email: "newperson@example.com", role_id: roleId });

    await expect(addStaffMember(data)).rejects.toThrow(
      "redirect:/en/admin/staff?saved=preauthorized",
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "lookup_user_by_email", {
      p_email: "newperson@example.com",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "preauthorize_staff_member", {
      p_email: "newperson@example.com",
      p_role_id: roleId,
    });
  });

  it("revokes a pending staff invite with staff.manage permission", async () => {
    const inviteId = "00000000-0000-4000-8000-000000002703";
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    const data = form({ locale: "en", invite_id: inviteId });

    await expect(revokeStaffInvite(data)).rejects.toThrow(
      "redirect:/en/admin/staff?saved=inviteRevoked",
    );
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_staff_invite", {
      p_invite_id: inviteId,
    });
  });

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
