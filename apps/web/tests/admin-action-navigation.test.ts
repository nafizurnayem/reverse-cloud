import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }),
  revalidatePath: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  createServer: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServer }));

import { setClientArchived } from "../src/app/[locale]/admin/clients/actions";
import { proxy } from "../src/proxy";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reverse-cloud.example");
  vi.stubEnv("TRUSTED_PUBLIC_ORIGINS", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
});

describe("archive action navigation behind the hosting proxy", () => {
  it.each([
    ["en", "admin"], ["bn", "admin"],
    ["en", "project_manager"], ["bn", "project_manager"],
    ["en", "developer"], ["bn", "developer"],
  ])("renders the %s %s destination without an external redirect", async (locale, role) => {
    mocks.requirePermission.mockResolvedValue({
      access: { roles: [{ key: role, name: role }] },
      supabase: { from: () => ({ update: mocks.update }) },
    });
    const roleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ roles: { key: role } }], error: null }),
    };
    mocks.createServer.mockReturnValue({
      auth: { getClaims: async () => ({ data: { claims: { sub: "staff-1" } }, error: null }) },
      from: () => roleQuery,
    });
    const id = "00000000-0000-4000-8000-000000000010";
    const form = new FormData();
    form.set("locale", locale);
    form.set("id", id);
    form.set("archived", "true");

    await expect(setClientArchived(form)).rejects.toThrow("redirect:");
    const destination = mocks.redirect.mock.calls[0][0];
    // Next.js renders an action redirect by fetching it from the internal origin.
    const response = await proxy(new NextRequest(`http://localhost:3000${destination}`, {
      headers: {
        cookie: `sb-session=test-session; NEXT_LOCALE=${locale}`,
        rsc: "1",
        "x-forwarded-host": "reverse-cloud.example",
        "x-forwarded-proto": "https",
      },
    }));

    expect(response.headers.get("location")).toBeNull();
    expect(destination).toBe(`/${role}/clients?edit=${id}&saved=archived`);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `http://localhost:3000/${locale}/admin/clients?edit=${id}&saved=archived`,
    );
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-session=test-session");
    expect(response.headers.get("x-middleware-request-rsc")).toBe("1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/${locale}/admin/clients`);
    expect(mocks.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
  });
});
