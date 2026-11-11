import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  leadLookup: vi.fn(),
  leadInsert: vi.fn(),
  leadUpdate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const leadsQuery: Record<string, unknown> = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      update: mocks.leadUpdate,
      insert: mocks.leadInsert,
      maybeSingle: mocks.leadLookup,
    };
    (leadsQuery.select as ReturnType<typeof vi.fn>).mockReturnValue(leadsQuery);
    (leadsQuery.eq as ReturnType<typeof vi.fn>).mockReturnValue(leadsQuery);
    (leadsQuery.order as ReturnType<typeof vi.fn>).mockReturnValue(leadsQuery);
    (leadsQuery.limit as ReturnType<typeof vi.fn>).mockReturnValue(leadsQuery);

    return {
      rpc: mocks.rpc,
      from: (table: string) => {
        mocks.from(table);
        return leadsQuery;
      },
    };
  },
}));
import { POST } from "../src/app/api/webhooks/calcom/route";

const secret = "test-calcom-secret";
function request(body: Record<string, unknown>, signature?: string) {
  const raw = JSON.stringify(body);
  return new NextRequest("http://localhost/api/webhooks/calcom", { method: "POST",
    headers: { "content-type": "application/json", "x-cal-signature-256": signature
      ?? createHmac("sha256", secret).update(raw).digest("hex") }, body: raw });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALCOM_WEBHOOK_SECRET", secret);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.leadLookup.mockResolvedValue({ data: null, error: null });
  mocks.leadInsert.mockResolvedValue({ data: null, error: null });
  mocks.leadUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
});

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

  it("syncs attendee phone number from webhook metadata to leads table", async () => {
    const body = {
      triggerEvent: "BOOKING_CREATED",
      uid: "cal-booking-456",
      createdAt: "2026-10-15T12:00:00Z",
      payload: {
        startTime: "2026-11-01T10:00:00Z",
        endTime: "2026-11-01T10:30:00Z",
        attendeeName: "Bob Client",
        attendee_email: "bob@example.com",
        attendeeTimezone: "UTC",
        eventType: { slug: "discovery_call" },
        metadata: { phone: "+8801813609364" },
      },
    };
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledWith("leads");
    expect(mocks.leadInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Bob Client",
        email: "bob@example.com",
        phone: "+8801813609364",
        source: "chat",
      }),
    );
  });

  it("updates existing lead without phone when webhook includes phone", async () => {
    mocks.leadLookup.mockResolvedValueOnce({
      data: { id: "existing-lead-id", phone: null },
      error: null,
    });
    const body = {
      triggerEvent: "BOOKING_CREATED",
      uid: "cal-booking-789",
      createdAt: "2026-10-15T12:00:00Z",
      payload: {
        startTime: "2026-11-01T10:00:00Z",
        endTime: "2026-11-01T10:30:00Z",
        attendeeName: "Bob Client",
        attendee_email: "bob@example.com",
        attendeeTimezone: "UTC",
        eventType: { slug: "discovery_call" },
        metadata: { phone: "+8801813609364" },
      },
    };
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(mocks.leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+8801813609364",
      }),
    );
    expect(mocks.leadInsert).not.toHaveBeenCalled();
  });
});
