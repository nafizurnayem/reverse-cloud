import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  verify: vi.fn(),
  meeting: vi.fn(),
  adminRpc: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ratelimit", () => ({
  requestIp: () => "192.0.2.80",
  limitScheduleBookingRequests: mocks.limit,
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: mocks.verify }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: mocks.meeting,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    return { from: vi.fn(() => query) };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.adminRpc }),
}));

import { POST } from "../src/app/api/schedule/book/route";

const input = {
  meetingType: "discovery_call",
  start: "2027-01-10T10:00:00Z",
  end: "2027-01-10T10:30:00Z",
  timeZone: "Asia/Dhaka",
  name: "Client Person",
  email: "CLIENT@EXAMPLE.COM",
  company: "Example Ltd",
  notes: "Discuss the new portal",
  locale: "en",
  turnstileToken: "turnstile-token",
};

function request(body: unknown) {
  return new NextRequest("http://localhost/api/schedule/book", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function slotsResponse(slots = [{
  start: "2027-01-10T10:00:00Z",
  end: "2027-01-10T10:30:00Z",
}]) {
  return new Response(JSON.stringify({ status: "success", data: { slots } }), { status: 200 });
}

function bookingResponse(status = 201) {
  return new Response(JSON.stringify({
    status: status === 201 ? "success" : "error",
    data: status === 201 ? {
      uid: "schedule-booking-123",
      status: "accepted",
      start: "2027-01-10T10:00:00Z",
      end: "2027-01-10T10:30:00Z",
      meetingUrl: "https://cal.com/video/schedule-booking-123",
    } : undefined,
  }), { status });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALCOM_API_KEY", "cal_test_key");
  vi.stubEnv("CALCOM_API_BASE_URL", "https://api.cal.com/v2");
  mocks.limit.mockResolvedValue({ allowed: true, limit: 5, remaining: 4, reset: 4_600 });
  mocks.verify.mockResolvedValue({ success: true, errors: [] });
  mocks.meeting.mockResolvedValue({
    data: {
      id: "00000000-0000-4000-8000-000000000018",
      key: "discovery_call",
      duration_min: 30,
      calcom_event_type_id: "12345",
    },
    error: null,
  });
  mocks.adminRpc.mockResolvedValue({ data: true, error: null });
  mocks.fetch.mockResolvedValueOnce(slotsResponse()).mockResolvedValueOnce(bookingResponse());
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/schedule/book", () => {
  it("rechecks availability, creates a real booking, and records the UID", async () => {
    const response = await POST(request(input));

    expect(response.status).toBe(201);
    expect(response.headers.get("x-ratelimit-remaining")).toBe("4");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      booking: {
        uid: "schedule-booking-123",
        startsAt: "2027-01-10T10:00:00.000Z",
        endsAt: "2027-01-10T10:30:00.000Z",
        meetingUrl: "https://cal.com/video/schedule-booking-123",
      },
    });
    expect(mocks.verify).toHaveBeenCalledWith("turnstile-token", "192.0.2.80", {
      expectedAction: "schedule_booking",
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const [bookingUrl, bookingInit] = mocks.fetch.mock.calls[1] as [string, RequestInit];
    expect(bookingUrl).toBe("https://api.cal.com/v2/bookings");
    expect(JSON.parse(String(bookingInit.body))).toMatchObject({
      start: "2027-01-10T10:00:00.000Z",
      attendee: { name: "Client Person", email: "client@example.com", timeZone: "Asia/Dhaka" },
      metadata: {
        company: "Example Ltd",
        notes: "Discuss the new portal",
        source: "reverse_cloud_schedule",
      },
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "process_calcom_webhook_delivery",
      expect.objectContaining({
        p_booking_uid: "schedule-booking-123",
        p_proposal_id: null,
        p_attendee_email: "client@example.com",
      }),
    );
  });

  it("rejects invalid input before protection or external work", async () => {
    const response = await POST(request({ ...input, email: "bad-email" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "invalid_input" });
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("enforces rate limiting before Turnstile", async () => {
    mocks.limit.mockResolvedValue({ allowed: false, limit: 5, remaining: 0, reset: 4_600 });

    const response = await POST(request(input));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("requires a valid schedule-booking Turnstile challenge", async () => {
    mocks.verify.mockResolvedValue({ success: false, errors: ["invalid-input-response"] });

    const response = await POST(request(input));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "turnstile_failed" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not create a booking when the selected slot disappeared", async () => {
    mocks.fetch.mockReset().mockResolvedValueOnce(slotsResponse([]));

    const response = await POST(request(input));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "slot_unavailable" });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it("returns a stable conflict when Cal.com rejects the booking", async () => {
    mocks.fetch.mockReset()
      .mockResolvedValueOnce(slotsResponse())
      .mockResolvedValueOnce(bookingResponse(409));

    const response = await POST(request(input));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "slot_unavailable" });
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
});
