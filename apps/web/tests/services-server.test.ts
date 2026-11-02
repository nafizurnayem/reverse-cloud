import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getPublicSupabaseEnv: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/env", () => ({ getPublicSupabaseEnv: mocks.getPublicSupabaseEnv }));

import { getPublishedServices } from "../src/lib/services-server";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPublicSupabaseEnv.mockReturnValue({ url: "https://example.supabase.co", key: "public" });
});

describe("published services", () => {
  it("includes a newly published database service", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: "00000000-0000-4000-8000-000000000001",
        slug: "new-admin-service",
        name_en: "New Admin Service",
        name_bn: null,
        summary_en: "Created from the admin page.",
        summary_bn: null,
        body_en: "Service details.",
        body_bn: null,
        icon: null,
        pricing_model: "custom",
        starting_from_usd: null,
        sort_order: 50,
      }],
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order,
    };
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    const services = await getPublishedServices();

    expect(services.map((service) => service.slug)).toContain("new-admin-service");
    expect(services[0]).toMatchObject({
      name_bn: "New Admin Service",
      summary_bn: "Created from the admin page.",
      icon: "Globe",
    });
  });
});
