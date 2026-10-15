import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "../src/app/api/webhooks/calcom/route";

const secret = "security-secret-key-4.5";
function signedRaw(raw: string, signingSecret = secret) {
  return new NextRequest("http://localhost/api/webhooks/calcom", { method: "POST",
    headers: { "content-type": "application/json",
      "x-cal-signature-256": createHmac("sha256", signingSecret).update(raw).digest("hex") }, body: raw });
}

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CALCOM_WEBHOOK_SECRET", secret); mocks.rpc.mockResolvedValue({ data: true, error: null }); });

describe("booking webhook security", () => {
  it("rejects missing and forged signatures before database work", async () => {
    const raw = JSON.stringify({ triggerEvent: "BOOKING_CONFIRMED", createdAt: "2026-10-15T12:00:00Z" });
    const missing = new NextRequest("http://localhost/api/webhooks/calcom", { method: "POST", body: raw });
    expect((await POST(missing)).status).toBe(401);
    expect((await POST(signedRaw(raw, "attacker-secret"))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON after authenticating the raw body", async () => {
    const response = await POST(signedRaw('{"triggerEvent":"BOOKING_CONFIRMED","uid":'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "invalid_json" });
  });

  it("normalizes attendee email and sends only explicit fields to the RPC", async () => {
    const raw = JSON.stringify({ triggerEvent: "BOOKING_CONFIRMED", uid: "valid-booking-100",
      createdAt: "2026-10-15T12:00:00Z", payload: { startTime: "2026-11-10T14:00:00Z",
        endTime: "2026-11-10T14:30:00Z", attendeeName: "Test Lead",
        attendeeEmail: "  TEST.LEAD@EXAMPLE.COM  ", attendeeTimezone: "Asia/Dhaka",
        eventType: { slug: "discovery_call" } } });
    expect((await POST(signedRaw(raw))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("process_calcom_webhook_delivery", expect.objectContaining({
      p_attendee_email: "test.lead@example.com", p_booking_uid: "valid-booking-100",
    }));
    expect(JSON.stringify(mocks.rpc.mock.calls[0])).not.toContain("calcom_payload");
  });

  it("rejects incomplete booking lifecycle events", async () => {
    const raw = JSON.stringify({ triggerEvent: "BOOKING_CONFIRMED", uid: "incomplete-uid",
      createdAt: "2026-10-15T12:00:00Z", payload: { attendeeEmail: "test@example.com" } });
    const response = await POST(signedRaw(raw));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "incomplete_event" });
  });

  it("limits unsigned payloads even when content-length is absent", async () => {
    const oversized = JSON.stringify({ triggerEvent: "BOOKING_CONFIRMED", value: "x".repeat(300_000) });
    const response = await POST(signedRaw(oversized));
    expect(response.status).toBe(413);
  });
});
