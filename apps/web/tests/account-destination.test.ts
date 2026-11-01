import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isActiveStaff: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/roles", () => ({ isActiveStaff: mocks.isActiveStaff }));

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
  mocks.isActiveStaff.mockResolvedValue(false);
});

describe("post-login account destination", () => {
  it("sends staff to admin without treating them as clients", async () => {
    const { supabase } = clientWith(null);
    mocks.isActiveStaff.mockResolvedValue(true);
    expect(await accountDestination(supabase as never, "staff-1", "en")).toBe("/en/admin");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("sends only linked clients to the portal", async () => {
    const { supabase, query } = clientWith("client-1");
    expect(await accountDestination(supabase as never, "user-1", "bn")).toBe("/bn/portal");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("leaves unassigned users on the public site", async () => {
    const { supabase } = clientWith(null);
    expect(await accountDestination(supabase as never, "user-1", "en")).toBe("/en");
  });
});
