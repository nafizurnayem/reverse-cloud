import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  getMockEvents,
  sampleBookingProposal,
} from "../src/lib/chat/mock-stream";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  userRpc: vi.fn(),
  adminRpc: vi.fn(),
  adminFrom: vi.fn(),
  adminUpdate: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.userRpc,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.adminRpc,
    from: mocks.adminFrom,
  }),
}));

import { POST } from "../src/app/api/chat/confirm-booking/route";

const proposalId = "00000000-0000-4000-8000-000000000031";
const userId = "00000000-0000-4000-8000-000000000101";

const confirmedProposal = {
  proposal_id: proposalId,
  status: "confirmed",
  starts_at: "2027-01-10T10:00:00Z",
  ends_at: "2027-01-10T10:30:00Z",
  timezone: "Asia/Dhaka",
  intake_summary: "Discuss the new client portal",
  meeting_type_id: "00000000-0000-4000-8000-000000000018",
  meeting_type_key: "discovery_call",
  meeting_name: "Discovery Call",
  calcom_event_type_id: "12345",
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/chat/confirm-booking", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALCOM_API_KEY", "cal_test_key");
  vi.stubEnv("CALCOM_API_BASE_URL", "https://api.cal.com/v2");
  vi.stubEnv("CALCOM_API_VERSION", "2024-09-04");
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email: "CLIENT@EXAMPLE.COM",
        user_metadata: { full_name: "Client Person", locale: "bn" },
      },
    },
    error: null,
  });
  mocks.userRpc.mockResolvedValue({ data: confirmedProposal, error: null });
  mocks.adminRpc.mockResolvedValue({ data: true, error: null });
  const updateChain = { eq: vi.fn() };
  updateChain.eq.mockReturnValue(updateChain);
  mocks.adminUpdate.mockReturnValue(updateChain);
  mocks.adminFrom.mockReturnValue({ update: mocks.adminUpdate });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
    status: "success",
    data: {
      uid: "booking-uid-123",
      status: "accepted",
      start: "2027-01-10T10:00:00Z",
      end: "2027-01-10T10:30:00Z",
      meetingUrl: "https://cal.com/video/booking-uid-123",
    },
  }), { status: 201, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Chat Booking Cards Protocol & Mock Stream", () => {
  it("provides valid booking proposal card events", () => {
    expect(sampleBookingProposal.proposalId).toBe("prop-mock-4401");
    expect(sampleBookingProposal.durationMinutes).toBe(45);
    expect(new Date(sampleBookingProposal.endsAt).getTime()).toBeGreaterThan(
      new Date(sampleBookingProposal.startsAt).getTime(),
    );
    expect(getMockEvents("booking_proposal", "en").some(
      (event) => event.event === "card" && (event.data as { type: string }).type === "booking_proposal",
    )).toBe(true);
  });
});

describe("POST /api/chat/confirm-booking", () => {
  it("requires an authenticated user before claiming a proposal", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("No session") });

    const response = await POST(makeRequest({ proposalId }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "unauthorized" });
    expect(mocks.userRpc).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid proposal ID before database or Cal.com work", async () => {
    const response = await POST(makeRequest({ proposalId: "not-a-uuid" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "invalid_proposal_id" });
    expect(mocks.userRpc).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("claims through the secure RPC, creates a real booking, and records its UID", async () => {
    const response = await POST(makeRequest({ proposalId }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      proposalId,
      status: "confirmed",
      booking: {
        uid: "booking-uid-123",
        startsAt: "2027-01-10T10:00:00.000Z",
        endsAt: "2027-01-10T10:30:00.000Z",
        meetingUrl: "https://cal.com/video/booking-uid-123",
      },
    });
    expect(mocks.userRpc).toHaveBeenCalledWith("confirm_booking_proposal", {
      p_proposal_id: proposalId,
    });

    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.cal.com/v2/bookings");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer cal_test_key");
    const bookingBody = JSON.parse(String(init.body));
    expect(bookingBody).toEqual({
      start: "2027-01-10T10:00:00.000Z",
      attendee: {
        name: "Client Person",
        email: "client@example.com",
        timeZone: "Asia/Dhaka",
        language: "bn",
      },
      eventTypeId: 12345,
      metadata: { bookingProposalId: proposalId, source: "reverse_cloud_chat" },
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "process_calcom_webhook_delivery",
      expect.objectContaining({
        p_booking_uid: "booking-uid-123",
        p_proposal_id: proposalId,
        p_attendee_email: "client@example.com",
      }),
    );
  });

  it("maps an expired proposal to a stable conflict response without leaking SQL", async () => {
    mocks.userRpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "proposal_expired: booking_proposals internal detail" },
    });

    const response = await POST(makeRequest({ proposalId }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "expired",
      message: "This booking proposal has expired. Please select a new slot.",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("marks the claimed proposal failed when Cal.com rejects the slot", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: "error" }), { status: 409 }));

    const response = await POST(makeRequest({ proposalId }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "slot_unavailable" });
    expect(mocks.adminFrom).toHaveBeenCalledWith("booking_proposals");
    expect(mocks.adminUpdate).toHaveBeenCalledWith({ status: "failed" });
    const chain = mocks.adminUpdate.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("id", proposalId);
    expect(chain.eq).toHaveBeenCalledWith("confirmed_by", userId);
    expect(chain.eq).toHaveBeenCalledWith("status", "confirmed");
  });

  it("does not claim a proposal when Cal.com is not configured", async () => {
    vi.stubEnv("CALCOM_API_KEY", "");

    const response = await POST(makeRequest({ proposalId }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "scheduling_not_configured" });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.userRpc).not.toHaveBeenCalled();
  });
});
