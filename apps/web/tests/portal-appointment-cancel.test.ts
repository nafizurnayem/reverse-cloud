import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  meeting: vi.fn(),
  rpc: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      maybeSingle: mocks.meeting,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    return {
      auth: { getUser: mocks.getUser },
      from: vi.fn(() => query),
    };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { DELETE } from "../src/app/api/portal/appointments/[id]/cancel/route";

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
  mocks.meeting.mockResolvedValue({
    data: {
      id: appointmentId,
      client_id: "client-1",
      calcom_booking_uid: "booking-uid-123",
      starts_at: "2099-01-10T10:00:00.000Z",
      status: "confirmed",
    },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: "success" }), { status: 200 }));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("DELETE /api/portal/appointments/[id]/cancel", () => {
  it("cancels the authenticated client's future booking and synchronizes its status", async () => {
    const response = await DELETE(request(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.cal.com/v2/bookings/booking-uid-123/cancel",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "process_calcom_webhook_delivery",
      expect.objectContaining({
        p_trigger_event: "BOOKING_CANCELLED",
        p_booking_uid: "booking-uid-123",
      }),
    );
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
    expect(mocks.rpc).not.toHaveBeenCalled();
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
