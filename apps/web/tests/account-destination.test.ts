import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getActiveStaffRoleKeys: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/roles", () => ({
  getActiveStaffRoleKeys: mocks.getActiveStaffRoleKeys,
}));

import { accountDestination } from "../src/lib/auth/destination";

function clientWith(id: string | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: id ? { id } : null, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const supabase = { from: vi.fn().mockReturnValue(query) };
  return { supabase, query };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getActiveStaffRoleKeys.mockResolvedValue([]);
});

describe("post-login account destination", () => {
  it.each([
    [["admin"], "/admin"],
    [["project_manager"], "/project_manager"],
    [["developer"], "/developer"],
  ])("sends the %s role to %s without treating staff as clients", async (roles, expected) => {
    const { supabase } = clientWith(null);
    mocks.getActiveStaffRoleKeys.mockResolvedValue(roles);
    expect(await accountDestination(supabase as never, "staff-1", "en")).toBe(expected);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("sends only linked clients to the portal", async () => {
    const { supabase, query } = clientWith("client-1");
    expect(await accountDestination(supabase as never, "user-1", "bn")).toBe("/portal");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("leaves unassigned users on the public site", async () => {
    const { supabase } = clientWith(null);
    expect(await accountDestination(supabase as never, "user-1", "en")).toBe("/");
  });
});
