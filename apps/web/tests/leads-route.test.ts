import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  verify: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ratelimit", () => ({
  requestIp: () => "192.0.2.10",
  limitContactRequests: mocks.limit,
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: mocks.verify }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { POST } from "../src/app/api/leads/route";

const payload = {
  name: "Nafiz",
  email: "nafiz@example.com",
  phone: "",
  company: "Reverse Cloud",
  country: "Bangladesh",
  locale: "en",
  message: "Please build a website for us.",
  serviceId: null,
  consent: true,
  turnstileToken: "turnstile-token",
  utm: { utm_source: "test" },
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STAFF_NOTIFICATION_EMAIL", "staff@example.com");
  vi.stubEnv("TELEGRAM_CHAT_ID", "12345");
  mocks.limit.mockResolvedValue({ allowed: true, limit: 5, remaining: 4, reset: 4600 });
  mocks.verify.mockResolvedValue({ success: true, errors: [] });
  mocks.rpc.mockResolvedValue({ data: "00000000-0000-4000-8000-000000000010", error: null });
});

describe("POST /api/leads", () => {
  it("verifies protection and calls the atomic lead/outbox function", async () => {
    const response = await POST(request(payload));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(mocks.verify).toHaveBeenCalledWith("turnstile-token", "192.0.2.10");
    expect(mocks.rpc).toHaveBeenCalledWith("create_contact_lead", expect.objectContaining({
      p_email: "nafiz@example.com",
      p_staff_email: "staff@example.com",
      p_telegram_chat_id: "12345",
    }));
  });

  it("rejects blocked requests before Turnstile or database work", async () => {
    mocks.limit.mockResolvedValue({ allowed: false, limit: 5, remaining: 0, reset: 4600 });
    const response = await POST(request(payload));
    expect(response.status).toBe(429);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid contact data before consuming protection services", async () => {
    const response = await POST(request({ ...payload, email: "", phone: "" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "contact_required" });
    expect(mocks.limit).not.toHaveBeenCalled();
  });
});
