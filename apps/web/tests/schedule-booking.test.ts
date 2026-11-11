import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  meeting: vi.fn(),
  activeBooking: vi.fn(),
  adminFrom: vi.fn(),
  adminRpc: vi.fn(),
  getUser: vi.fn(),
  fetch: vi.fn(),
  leadLookup: vi.fn(),
  leadInsert: vi.fn(),
  leadUpdate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ratelimit", () => ({
  requestIp: () => "192.0.2.80",
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
    return { auth: { getUser: mocks.getUser }, from: vi.fn(() => query) };
  },
}));
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

    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      gt: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: mocks.activeBooking,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.gt.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    return {
      from: (table: string) => {
        mocks.adminFrom(table);
        if (table === "leads") return leadsQuery;
        return query;
      },
      rpc: mocks.adminRpc,
    };
  },
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
  mocks.verify.mockResolvedValue({ success: true, errors: [] });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.activeBooking.mockResolvedValue({ data: null, error: null });
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
  mocks.leadLookup.mockResolvedValue({ data: null, error: null });
  mocks.leadInsert.mockResolvedValue({ data: null, error: null });
  mocks.leadUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
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
    expect(mocks.adminFrom).toHaveBeenCalledWith("meetings");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const [bookingUrl, bookingInit] = mocks.fetch.mock.calls[1] as [string, RequestInit];
    expect(bookingUrl).toBe("https://api.cal.com/v2/bookings");
    expect(new Headers(bookingInit.headers).get("cal-api-version")).toBe("2024-08-13");
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

  it("lets a signed-in user confirm directly with verified account details", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          email: "SIGNED-IN@EXAMPLE.COM",
          user_metadata: { full_name: "Signed In Person" },
        },
      },
      error: null,
    });

    const response = await POST(request({
      ...input,
      name: "Ignored Name",
      email: "ignored@example.com",
      source: "chat",
      phone: null,
      turnstileToken: "",
    }));

    expect(response.status).toBe(201);
    expect(mocks.verify).not.toHaveBeenCalled();
    const bookingBody = JSON.parse(String(mocks.fetch.mock.calls[1][1].body));
    expect(bookingBody.attendee).toMatchObject({
      name: "Signed In Person",
      email: "signed-in@example.com",
    });
    expect(bookingBody.metadata.source).toBe("reverse_cloud_chat");
  });

  it("requires and records a guest phone number for chat bookings and persists lead", async () => {
    const response = await POST(request({
      ...input,
      source: "chat",
      phone: "+880 1700 000000",
    }));

    expect(response.status).toBe(201);
    const bookingBody = JSON.parse(String(mocks.fetch.mock.calls[1][1].body));
    expect(bookingBody.metadata).toMatchObject({
      phone: "+880 1700 000000",
      source: "reverse_cloud_chat",
    });
    expect(mocks.leadInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Client Person",
        email: "client@example.com",
        phone: "+880 1700 000000",
        source: "chat",
      }),
    );
  });

  it("updates existing lead with phone number if lead already exists", async () => {
    mocks.leadLookup.mockResolvedValueOnce({
      data: { id: "existing-lead-uuid", phone: null },
      error: null,
    });

    const response = await POST(request({
      ...input,
      source: "chat",
      phone: "+880 1700 000000",
    }));

    expect(response.status).toBe(201);
    expect(mocks.leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+880 1700 000000",
        name: "Client Person",
      }),
    );
    expect(mocks.leadInsert).not.toHaveBeenCalled();
  });

  it("rejects a guest chat booking without a phone number", async () => {
    const response = await POST(request({ ...input, source: "chat", phone: null }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "phone_required" });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid input before protection or external work", async () => {
    const response = await POST(request({ ...input, email: "bad-email" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "invalid_input" });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.adminFrom).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects an email that already has an active future booking", async () => {
    mocks.activeBooking.mockResolvedValue({
      data: { ends_at: "2027-01-10T12:00:00.000Z" },
      error: null,
    });

    const response = await POST(request(input));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "active_booking_exists",
      availableAfter: "2027-01-10T12:00:00.000Z",
    });
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.adminFrom).toHaveBeenCalledWith("meetings");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  it("fails closed when the active-booking lookup is unavailable", async () => {
    mocks.activeBooking.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    const response = await POST(request(input));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "scheduling_unavailable" });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
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

  it("does not misreport Cal.com validation errors as unavailable slots", async () => {
    mocks.fetch.mockReset()
      .mockResolvedValueOnce(slotsResponse())
      .mockResolvedValueOnce(bookingResponse(422));

    const response = await POST(request(input));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: "scheduling_unavailable" });
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
});
