import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: mocks.select.mockReturnValue({
        limit: mocks.limit,
      }),
    }),
  }),
}));

import { GET } from "../src/app/api/health/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
});

describe("GET /api/health", () => {
  it("returns 200 ok when database probe succeeds", async () => {
    mocks.limit.mockResolvedValue({ data: [{ id: "1" }], error: null });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("web");
    expect(body.database.connected).toBe(true);
  });

  it("returns 503 degraded when database probe errors", async () => {
    mocks.limit.mockResolvedValue({ data: null, error: new Error("connection timeout") });

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.database.connected).toBe(false);
  });

  it("falls back to the legacy anon key when the publishable key is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    mocks.limit.mockResolvedValue({ data: [{ id: "1" }], error: null });

    const res = await GET();

    expect(res.status).toBe(200);
  });
});
