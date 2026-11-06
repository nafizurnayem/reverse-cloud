import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ rate: vi.fn(), meeting: vi.fn(), rpc: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ratelimit", () => ({ requestIp: () => "192.0.2.44", limitScheduleRequests: mocks.rate }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => {
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: mocks.meeting };
  return { from: vi.fn(() => query) };
} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));

import { GET } from "../src/app/api/schedule/slots/route";
import { POST } from "../src/app/api/webhooks/calcom/route";
import { cancelCalcomBooking, normalizeSlots, parseScheduleQuery } from "../src/lib/calcom";

const range = "meetingType=discovery_call&start=2027-01-01T00%3A00%3A00Z&end=2027-01-03T00%3A00%3A00Z&timeZone=Asia%2FDhaka";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALCOM_API_KEY", "cal_test_key");
  vi.stubEnv("CALCOM_WEBHOOK_SECRET_CURRENT", "webhook-secret");
  mocks.rate.mockResolvedValue({ allowed: true, limit: 30, remaining: 29, reset: 60 });
  mocks.meeting.mockResolvedValue({ data: { key: "discovery_call", name_en: "Discovery Call",
    name_bn: "ডিসকভারি কল", duration_min: 30, calcom_event_type_id: "12345" }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: "success",
    data: { "2027-01-01": [{ start: "2027-01-01T09:00:00Z", end: "2027-01-01T09:30:00Z" }] } }),
  { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Cal.com scheduling", () => {
  it("validates ranges and normalizes Cal.com slot maps", () => {
    expect(parseScheduleQuery(new URLSearchParams(range), Date.parse("2026-12-01T00:00:00Z")))
      .toMatchObject({ ok: true, value: { meetingType: "discovery_call", timeZone: "Asia/Dhaka" } });
    expect(normalizeSlots({ data: { day: [{ start: "2027-01-01T09:00:00Z", end: "2027-01-01T09:30:00Z" }] } }, 30))
      .toEqual([{ start: "2027-01-01T09:00:00.000Z", end: "2027-01-01T09:30:00.000Z" }]);
  });

  it("cancels a Cal.com booking using the protected v2 endpoint", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: "success" }), { status: 200 }));

    await cancelCalcomBooking({
      apiKey: "cal_test_key",
      bookingUid: "booking/uid 123",
      reason: "Client cancelled from portal",
    });

    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cal.com/v2/bookings/booking%2Fuid%20123/cancel");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer cal_test_key");
    expect(new Headers(init.headers).get("cal-api-version")).toBe("2026-02-25");
    expect(JSON.parse(String(init.body))).toEqual({ cancellationReason: "Client cancelled from portal" });
  });

  it("proxies active meeting-type availability using the current v2 contract", async () => {
    const response = await GET(new NextRequest(`http://localhost/api/schedule/slots?${range}`));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, meetingType: { key: "discovery_call" },
      slots: [{ start: "2027-01-01T09:00:00.000Z", end: "2027-01-01T09:30:00.000Z" }] });
    const [url, init] = mocks.fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/v2/slots");
    expect(url.searchParams.get("format")).toBe("range");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer cal_test_key");
  });

  it("rejects invalid requests before database or Cal.com work", async () => {
    expect((await GET(new NextRequest("http://localhost/api/schedule/slots?meetingType=bad"))).status).toBe(400);
    expect(mocks.meeting).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("Cal.com webhook", () => {
  function signed(body: string, signature?: string) {
    return new NextRequest("http://localhost/api/webhooks/calcom", { method: "POST",
      headers: { "content-type": "application/json", "x-cal-signature-256": signature
        ?? createHmac("sha256", "webhook-secret").update(body).digest("hex") }, body });
  }

  it("parses the default nested payload and calls the atomic RPC without storing it", async () => {
    const body = JSON.stringify({ triggerEvent: "BOOKING_CONFIRMED", createdAt: "2026-10-15T12:00:00Z",
      payload: { uid: "booking-1", eventTypeId: 12345, type: "discovery-call",
        startTime: "2026-11-01T10:00:00Z", endTime: "2026-11-01T10:30:00Z",
        attendees: [{ name: "Test User", email: "test@example.com", timeZone: "Asia/Dhaka" }],
        metadata: { bookingProposalId: "00000000-0000-4000-8000-000000000026" } } });
    const response = await POST(signed(body));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("process_calcom_webhook_delivery", expect.objectContaining({
      p_booking_uid: "booking-1", p_event_type_id: "12345", p_meeting_type_key: "discovery-call",
      p_attendee_email: "test@example.com", p_proposal_id: "00000000-0000-4000-8000-000000000026",
    }));
    expect(JSON.stringify(mocks.rpc.mock.calls[0])).not.toContain("attendees");
  });

  it("rejects a bad signature before database work", async () => {
    expect((await POST(signed("{}", "0".repeat(64)))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("acknowledges a duplicate and ignores unrelated signed events", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const event = JSON.stringify({ triggerEvent: "BOOKING_CANCELLED", createdAt: "2026-10-15T13:00:00Z",
      payload: { uid: "booking-1" } });
    await expect((await POST(signed(event))).json()).resolves.toEqual({ ok: true, duplicate: true });
    const ignored = JSON.stringify({ triggerEvent: "MEETING_ENDED", createdAt: "2026-10-15T14:00:00Z", payload: {} });
    await expect((await POST(signed(ignored))).json()).resolves.toEqual({ ok: true, ignored: "MEETING_ENDED" });
  });
});
