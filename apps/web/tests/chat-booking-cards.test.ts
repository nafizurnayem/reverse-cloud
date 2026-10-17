import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  getMockEvents,
  sampleBookingProposal,
} from "../src/lib/chat/mock-stream";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: () => ({
      update: mocks.update,
      select: mocks.select,
    }),
  }),
}));

import { POST } from "../src/app/api/chat/confirm-booking/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/chat/confirm-booking", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Chat Booking Cards Protocol & Mock Stream", () => {
  it("provides valid sample booking proposal data", () => {
    expect(sampleBookingProposal.proposalId).toBe("prop-mock-4401");
    expect(sampleBookingProposal.durationMinutes).toBe(45);
    expect(sampleBookingProposal.status).toBe("open");
    expect(new Date(sampleBookingProposal.startsAt).getTime()).toBeGreaterThan(0);
    expect(new Date(sampleBookingProposal.endsAt).getTime()).toBeGreaterThan(
      new Date(sampleBookingProposal.startsAt).getTime(),
    );
  });

  it("generates booking_proposal mock events for en and bn locales", () => {
    const enEvents = getMockEvents("booking_proposal", "en");
    expect(enEvents.some((e) => e.event === "card" && (e.data as { type: string }).type === "booking_proposal")).toBe(true);
    expect(enEvents.some((e) => e.event === "text_delta")).toBe(true);

    const bnEvents = getMockEvents("booking_proposal", "bn");
    expect(bnEvents.some((e) => e.event === "card" && (e.data as { type: string }).type === "booking_proposal")).toBe(true);
    const bnText = bnEvents
      .filter((e) => e.event === "text_delta")
      .map((e) => (e.data as { text: string }).text)
      .join("");
    expect(bnText).toContain("কনসালটেশন");
  });
});

describe("POST /api/chat/confirm-booking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("No session") });

    const res = await POST(makeRequest({ proposalId: "prop-123" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("unauthorized");
  });

  it("returns 400 when proposalId is missing", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-456", email: "client@example.com" } },
      error: null,
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("missing_proposal_id");
  });

  it("successfully confirms an open proposal for the authenticated user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-456", email: "client@example.com" } },
      error: null,
    });

    // Mock chaining: from("booking_proposals").update(...).eq(...).eq(...).gt(...).select(...).maybeSingle()
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.gt = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "prop-123",
        status: "confirmed",
        startsAt: "2026-10-20T10:00:00Z",
      },
      error: null,
    });
    mocks.update.mockReturnValue(chain);

    const res = await POST(makeRequest({ proposalId: "prop-123" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe("confirmed");
    expect(json.proposalId).toBe("prop-123");
  });

  it("returns 410 when proposal is expired", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-456", email: "client@example.com" } },
      error: null,
    });

    // First update returns null because expires_at has passed
    const updateChain: Record<string, unknown> = {};
    updateChain.eq = vi.fn().mockReturnValue(updateChain);
    updateChain.gt = vi.fn().mockReturnValue(updateChain);
    updateChain.select = vi.fn().mockReturnValue(updateChain);
    updateChain.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    mocks.update.mockReturnValue(updateChain);

    // Second query checks existing row status
    const selectChain: Record<string, unknown> = {};
    selectChain.eq = vi.fn().mockReturnValue(selectChain);
    selectChain.maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "prop-123",
        status: "expired",
        expires_at: "2026-10-01T00:00:00Z",
      },
      error: null,
    });
    mocks.select.mockReturnValue(selectChain);

    const res = await POST(makeRequest({ proposalId: "prop-123" }));
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("expired");
  });

  it("returns alreadyConfirmed when proposal is already confirmed", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-456", email: "client@example.com" } },
      error: null,
    });

    // First update returns null
    const updateChain: Record<string, unknown> = {};
    updateChain.eq = vi.fn().mockReturnValue(updateChain);
    updateChain.gt = vi.fn().mockReturnValue(updateChain);
    updateChain.select = vi.fn().mockReturnValue(updateChain);
    updateChain.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    mocks.update.mockReturnValue(updateChain);

    // Second query finds it already confirmed
    const selectChain: Record<string, unknown> = {};
    selectChain.eq = vi.fn().mockReturnValue(selectChain);
    selectChain.maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "prop-123",
        status: "confirmed",
        expires_at: "2026-10-25T00:00:00Z",
      },
      error: null,
    });
    mocks.select.mockReturnValue(selectChain);

    const res = await POST(makeRequest({ proposalId: "prop-123" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyConfirmed).toBe(true);
  });
});
