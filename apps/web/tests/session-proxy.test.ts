import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  limit: vi.fn(),
  createServer: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServer }));

import { config, proxy } from "../src/proxy";

let cookieAdapter: CookieMethodsServer;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://reverse-cloud.example");
  vi.stubEnv("TRUSTED_PUBLIC_ORIGINS", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });
  const query = { select: mocks.select, eq: mocks.eq, limit: mocks.limit };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.limit.mockResolvedValue({ data: [], error: null });
  mocks.createServer.mockImplementation((_url, _key, options) => {
    cookieAdapter = options.cookies;
    return { auth: { getClaims: mocks.getClaims }, from: mocks.from };
  });
});

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("session proxy", () => {
  it("canonicalizes all legacy locale prefixes and preserves the selected language", async () => {
    const response = await proxy(request("/en/bn/portal?tab=active"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://reverse-cloud.example/portal?tab=active",
    );
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("en");
  });

  it("matches protected dotted paths while excluding APIs and assets", () => {
    for (const url of [
      "/admin/user.json",
      "/developer/project.json",
      "/project_manager/reports.pdf",
      "/bn/portal/file.pdf",
      "/en/admin",
    ]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
    }
    for (const url of ["/api/leads", "/_next/static/file.js", "/favicon.ico"]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false);
    }
  });

  it("redirects an unprefixed protected route to the clean login URL", async () => {
    const response = await proxy(request("/admin?tab=staff", { "accept-language": "bn" }));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/admin?tab=staff");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("uses only allow-listed forwarded origins for protected redirects", async () => {
    vi.stubEnv("TRUSTED_PUBLIC_ORIGINS", "https://public-tunnel.example");

    let response = await proxy(request("/portal", {
      "x-forwarded-host": "public-tunnel.example",
      "x-forwarded-proto": "https",
    }));
    expect(response.headers.get("location")).toBe(
      "https://public-tunnel.example/login?next=%2Fportal",
    );

    response = await proxy(request("/portal", {
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https",
    }));
    expect(response.headers.get("location")).toBe(
      "https://reverse-cloud.example/login?next=%2Fportal",
    );
  });

  it("preserves refreshed and deleted cookies on redirects", async () => {
    mocks.getClaims.mockImplementation(async () => {
      await cookieAdapter.setAll!([
        { name: "sb-session.0", value: "fresh", options: { path: "/", secure: true } },
        { name: "sb-session.1", value: "", options: { path: "/", maxAge: 0 } },
      ], { "Cache-Control": "private, no-store", Pragma: "no-cache" });
      return { data: { claims: null }, error: null };
    });

    const response = await proxy(request("/admin"));
    expect(response.cookies.get("sb-session.0")?.value).toBe("fresh");
    expect(response.cookies.get("sb-session.0")?.secure).toBe(true);
    expect(response.cookies.get("sb-session.1")?.maxAge).toBe(0);
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("denies signed-in users without an active database staff role", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-1", user_metadata: { role: "admin" } } },
      error: null,
    });
    const response = await proxy(request("/admin"));
    expect(response.status).toBe(403);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("allows any active staff role and keeps session responses private", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "developer-1" } }, error: null });
    mocks.limit.mockResolvedValue({ data: [{ roles: { key: "developer" } }], error: null });
    const response = await proxy(request("/admin", { Cookie: "NEXT_LOCALE=bn" }));
    expect(response.headers.get("location")).toBe("https://reverse-cloud.example/developer");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it.each([
    ["admin", "/admin"],
    ["project_manager", "/project_manager"],
    ["developer", "/developer"],
  ])("keeps the %s dashboard on the locale-free %s URL", async (role, path) => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: `${role}-1` } }, error: null });
    mocks.limit.mockResolvedValue({ data: [{ roles: { key: role } }], error: null });

    const response = await proxy(request(path, { Cookie: "NEXT_LOCALE=bn" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/bn/admin",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("forwards refreshed session cookies to rewritten admin requests", async () => {
    mocks.getClaims.mockImplementation(async () => {
      await cookieAdapter.setAll!([
        { name: "sb-session.0", value: "fresh", options: { path: "/", secure: true } },
      ], {});
      return { data: { claims: { sub: "admin-1" } }, error: null };
    });
    mocks.limit.mockResolvedValue({ data: [{ roles: { key: "admin" } }], error: null });

    const response = await proxy(request("/admin", { Cookie: "sb-session.0=stale" }));

    expect(response.headers.get("x-middleware-request-cookie")).toBe("sb-session.0=fresh");
  });

  it("corrects the clean dashboard URL for the signed-in role", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "manager-1" } }, error: null });
    mocks.limit.mockResolvedValue({
      data: [{ roles: { key: "project_manager" } }],
      error: null,
    });

    const response = await proxy(request("/developer/projects?tab=active", {
      Cookie: "NEXT_LOCALE=bn",
    }));

    expect(response.headers.get("location")).toBe(
      "https://reverse-cloud.example/project_manager/projects?tab=active",
    );
  });

  it("fails closed when auth is unavailable", async () => {
    mocks.getClaims.mockRejectedValue(new Error("network unavailable"));
    expect((await proxy(request("/portal"))).status).toBe(503);
  });
});
