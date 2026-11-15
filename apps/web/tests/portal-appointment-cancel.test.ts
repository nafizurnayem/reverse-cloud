import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  client: vi.fn(),
  meeting: vi.fn(),
  adminFrom: vi.fn(),
  updatedMeeting: vi.fn(),
  updateMeeting: vi.fn(),
  updateProposal: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const meetingQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      gt: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: mocks.meeting,
    };
    meetingQuery.select.mockReturnValue(meetingQuery);
    meetingQuery.eq.mockReturnValue(meetingQuery);
    meetingQuery.in.mockReturnValue(meetingQuery);
    meetingQuery.gt.mockReturnValue(meetingQuery);
    meetingQuery.order.mockReturnValue(meetingQuery);
    meetingQuery.limit.mockReturnValue(meetingQuery);
    const clientQuery = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: mocks.client };
    clientQuery.select.mockReturnValue(clientQuery);
    clientQuery.eq.mockReturnValue(clientQuery);
    clientQuery.is.mockReturnValue(clientQuery);
    return {
      auth: { getUser: mocks.getUser },
      from: vi.fn((table: string) => table === "clients" ? clientQuery : meetingQuery),
    };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const meetingQuery = {
      update: mocks.updateMeeting,
      eq: vi.fn(),
      in: vi.fn(),
      select: vi.fn(),
      maybeSingle: mocks.updatedMeeting,
    };
    meetingQuery.update.mockReturnValue(meetingQuery);
    meetingQuery.eq.mockReturnValue(meetingQuery);
    meetingQuery.in.mockReturnValue(meetingQuery);
    meetingQuery.select.mockReturnValue(meetingQuery);
    const proposalQuery = { update: mocks.updateProposal, eq: vi.fn() };
    proposalQuery.update.mockReturnValue(proposalQuery);
    proposalQuery.eq.mockResolvedValue({ error: null });
    return {
      from: (table: string) => {
        mocks.adminFrom(table);
        return table === "booking_proposals" ? proposalQuery : meetingQuery;
      },
    };
  },
}));

import { DELETE } from "../src/app/api/portal/appointments/[id]/cancel/route";
import { GET } from "../src/app/api/portal/appointments/upcoming/route";

const appointmentId = "00000000-0000-4000-8000-000000000123";

function request() {
  return new NextRequest(`http://localhost/api/portal/appointments/${appointmentId}/cancel`, {
    method: "DELETE",
  });
}

function context(id = appointmentId) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALCOM_API_KEY", "cal_test_key");
  vi.stubEnv("CALCOM_API_BASE_URL", "https://api.cal.com/v2");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.client.mockResolvedValue({ data: { id: "client-1" }, error: null });
  mocks.meeting.mockResolvedValue({
    data: {
      id: appointmentId,
      client_id: "client-1",
      proposal_id: "00000000-0000-4000-8000-000000000321",
      calcom_booking_uid: "booking-uid-123",
      starts_at: "2099-01-10T10:00:00.000Z",
      status: "confirmed",
    },
    error: null,
  });
  mocks.updatedMeeting.mockResolvedValue({ data: { id: appointmentId }, error: null });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: "success" }), { status: 200 }));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("DELETE /api/portal/appointments/[id]/cancel", () => {
  it("cancels Cal.com and marks the authenticated client's local records cancelled", async () => {
    const response = await DELETE(request(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.cal.com/v2/bookings/booking-uid-123/cancel",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mocks.adminFrom).toHaveBeenCalledWith("meetings");
    expect(mocks.updateMeeting).toHaveBeenCalledWith({ status: "cancelled" });
    expect(mocks.adminFrom).toHaveBeenCalledWith("booking_proposals");
    expect(mocks.updateProposal).toHaveBeenCalledWith({ status: "cancelled" });
    expect(mocks.updatedMeeting).toHaveBeenCalledOnce();
  });

  it("returns only the signed-in client's upcoming appointment", async () => {
    mocks.meeting.mockResolvedValue({
      data: {
        id: appointmentId,
        starts_at: "2099-01-10T10:00:00.000Z",
        ends_at: "2099-01-10T10:30:00.000Z",
        attendee_timezone: "Asia/Dhaka",
        status: "confirmed",
        meeting_types: { name_en: "Discovery Call", name_bn: "ডিসকভারি কল" },
      },
      error: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      appointment: { id: appointmentId, meetingTypeNameEn: "Discovery Call" },
    });
  });

  it("does not reveal appointment details to a guest", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "authentication_required" });
    expect(mocks.meeting).not.toHaveBeenCalled();
  });

  it("requires authentication before revealing appointment information", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await DELETE(request(), context());

    expect(response.status).toBe(401);
    expect(mocks.meeting).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not cancel a meeting hidden by ownership RLS", async () => {
    mocks.meeting.mockResolvedValue({ data: null, error: null });

    const response = await DELETE(request(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "appointment_not_found" });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });

  it("does not let an authenticated non-client inspect or cancel a booking", async () => {
    mocks.client.mockResolvedValue({ data: null, error: null });

    const response = await DELETE(request(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "appointment_not_found" });
    expect(mocks.meeting).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects cancellation after the meeting has started", async () => {
    mocks.meeting.mockResolvedValue({
      data: {
        id: appointmentId,
        client_id: "client-1",
        calcom_booking_uid: "booking-uid-123",
        starts_at: "2020-01-10T10:00:00.000Z",
        status: "confirmed",
      },
      error: null,
    });

    const response = await DELETE(request(), context());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ ok: false, code: "cancellation_closed" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
