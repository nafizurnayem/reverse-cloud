import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mocks.from,
  }),
}));

import { POST } from "../src/app/api/webhooks/calcom/route";

const SECRET = "test-calcom-secret";

function sign(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

function makeRequest(body: Record<string, unknown>, signature?: string) {
  const raw = JSON.stringify(body);
  const sig = signature !== undefined ? signature : sign(raw);
  return new NextRequest("http://localhost/api/webhooks/calcom", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cal-signature-256": sig,
    },
    body: raw,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CALCOM_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  mocks.upsert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });

  mocks.single.mockResolvedValue({ data: { id: "00000000-0000-4000-8000-000000000001" } });
  mocks.maybeSingle.mockResolvedValue({ data: { id: "00000000-0000-4000-8000-000000000002" } });

  mocks.select.mockReturnValue({
    eq: vi.fn().mockImplementation(() => ({
      single: mocks.single,
      maybeSingle: mocks.maybeSingle,
    })),
  });

  mocks.from.mockImplementation((table: string) => {
    if (table === "meeting_types" || table === "clients") {
      return { select: mocks.select };
    }
    return {
      upsert: mocks.upsert,
      update: mocks.update,
    };
  });
});

describe("Cal.com Webhook Handler", () => {
  it("rejects requests with invalid signature", async () => {
    const req = makeRequest({ triggerEvent: "BOOKING_CONFIRMED" }, "invalid-sig");
    const res = await POST(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "invalid signature" });
  });

  it("handles BOOKING_CONFIRMED by upserting meeting", async () => {
    const payload = {
      triggerEvent: "BOOKING_CONFIRMED",
      uid: "cal-booking-123",
      payload: {
        startTime: "2026-11-01T10:00:00Z",
        endTime: "2026-11-01T10:30:00Z",
        attendeeName: "Alice Client",
        attendee_email: "alice@example.com",
        attendeeTimezone: "UTC",
        eventType: { slug: "discovery_call" },
      },
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, uid: "cal-booking-123" });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        calcom_booking_uid: "cal-booking-123",
        status: "confirmed",
        attendee_email: "alice@example.com",
      }),
      { onConflict: "calcom_booking_uid" },
    );
  });

  it("handles BOOKING_RESCHEDULED by updating times and status", async () => {
    const payload = {
      triggerEvent: "BOOKING_RESCHEDULED",
      uid: "cal-booking-123",
      payload: {
        startTime: "2026-11-02T10:00:00Z",
        endTime: "2026-11-02T10:30:00Z",
      },
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, uid: "cal-booking-123" });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rescheduled",
        starts_at: "2026-11-02T10:00:00Z",
      }),
    );
  });

  it("handles BOOKING_CANCELLED by updating status", async () => {
    const payload = {
      triggerEvent: "BOOKING_CANCELLED",
      uid: "cal-booking-123",
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, uid: "cal-booking-123" });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
      }),
    );
  });

  it("handles BOOKING_CREATED by upserting meeting", async () => {
    const payload = {
      triggerEvent: "BOOKING_CREATED",
      uid: "cal-booking-456",
      payload: {
        startTime: "2026-11-05T10:00:00Z",
        endTime: "2026-11-05T10:30:00Z",
        attendeeName: "Bob Client",
        attendee_email: "bob@example.com",
        attendeeTimezone: "UTC",
        eventType: { slug: "discovery_call" },
      },
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, uid: "cal-booking-456" });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        calcom_booking_uid: "cal-booking-456",
        status: "confirmed",
        attendee_email: "bob@example.com",
      }),
      { onConflict: "calcom_booking_uid" },
    );
  });

  it("handles BOOKING_NO_SHOW_UPDATED by marking status as no_show", async () => {
    const payload = {
      triggerEvent: "BOOKING_NO_SHOW_UPDATED",
      uid: "cal-booking-123",
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no_show" }),
    );
  });

  it("handles BOOKING_REJECTED by marking status as cancelled", async () => {
    const payload = {
      triggerEvent: "BOOKING_REJECTED",
      uid: "cal-booking-123",
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("ignores non-lifecycle event triggers like MEETING_ENDED safely with 200", async () => {
    const payload = {
      triggerEvent: "MEETING_ENDED",
      uid: "cal-meeting-1",
    };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, ignored: "MEETING_ENDED" });
  });
});
