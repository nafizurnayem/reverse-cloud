import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "../src/app/api/webhooks/calcom/route";

const secret = "test-calcom-secret";
function request(body: Record<string, unknown>, signature?: string) {
  const raw = JSON.stringify(body);
  return new NextRequest("http://localhost/api/webhooks/calcom", { method: "POST",
    headers: { "content-type": "application/json", "x-cal-signature-256": signature
      ?? createHmac("sha256", secret).update(raw).digest("hex") }, body: raw });
}

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CALCOM_WEBHOOK_SECRET", secret); mocks.rpc.mockResolvedValue({ data: true, error: null }); });

describe("Cal.com webhook lifecycle", () => {
  it("rejects an invalid signature", async () => {
    const response = await POST(request({ triggerEvent: "BOOKING_CONFIRMED" }, "invalid"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "invalid_signature" });
  });

  it("sends a confirmed booking to the atomic delivery RPC", async () => {
    const body = { triggerEvent: "BOOKING_CONFIRMED", uid: "cal-booking-123", createdAt: "2026-10-15T12:00:00Z",
      payload: { startTime: "2026-11-01T10:00:00Z", endTime: "2026-11-01T10:30:00Z",
        attendeeName: "Alice Client", attendee_email: "alice@example.com", attendeeTimezone: "UTC",
        eventType: { slug: "discovery_call" } } };
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("process_calcom_webhook_delivery", expect.objectContaining({
      p_booking_uid: "cal-booking-123", p_meeting_type_key: "discovery_call",
      p_attendee_email: "alice@example.com",
    }));
  });

  for (const [trigger, expected] of [
    ["BOOKING_RESCHEDULED", "BOOKING_RESCHEDULED"], ["BOOKING_CANCELLED", "BOOKING_CANCELLED"],
    ["BOOKING_NO_SHOW_UPDATED", "BOOKING_NO_SHOW_UPDATED"], ["BOOKING_REJECTED", "BOOKING_REJECTED"],
  ] as const) {
    it(`handles ${trigger} through the same atomic contract`, async () => {
      const details = trigger === "BOOKING_RESCHEDULED" ? { startTime: "2026-11-02T10:00:00Z",
        endTime: "2026-11-02T10:30:00Z", attendeeName: "Alice", attendeeEmail: "alice@example.com" } : {};
      const body = { triggerEvent: trigger, uid: "cal-booking-123", createdAt: "2026-10-15T13:00:00Z", payload: details };
      expect((await POST(request(body))).status).toBe(200);
      expect(mocks.rpc).toHaveBeenCalledWith("process_calcom_webhook_delivery", expect.objectContaining({ p_trigger_event: expected }));
    });
  }

  it("acknowledges unrelated signed events", async () => {
    const response = await POST(request({ triggerEvent: "MEETING_ENDED", createdAt: "2026-10-15T14:00:00Z" }));
    await expect(response.json()).resolves.toEqual({ ok: true, ignored: "MEETING_ENDED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
