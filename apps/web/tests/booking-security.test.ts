import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mocks.from,
  }),
}));

import { POST as calcomPost } from "../src/app/api/webhooks/calcom/route";

const WEBHOOK_SECRET = "security-secret-key-4.5";

function sign(body: string, secret = WEBHOOK_SECRET) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function makeRequest(body: Record<string, unknown>, signatureHeader?: string) {
  const raw = JSON.stringify(body);
  const sig = signatureHeader !== undefined ? signatureHeader : sign(raw);
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
  vi.stubEnv("CALCOM_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  mocks.upsert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });

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

describe("§10 Booking & Security Integration Tests", () => {
  describe("Cryptographic Verification & Spoofing Defense", () => {
    it("rejects webhook with missing signature header", async () => {
      const raw = JSON.stringify({ triggerEvent: "BOOKING_CONFIRMED", uid: "1" });
      const req = new NextRequest("http://localhost/api/webhooks/calcom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw,
      });
      const res = await calcomPost(req);
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "invalid signature" });
    });

    it("rejects webhook signed with an incorrect or forged secret", async () => {
      const body = { triggerEvent: "BOOKING_CONFIRMED", uid: "forged-booking-1" };
      const forgedSig = sign(JSON.stringify(body), "wrong-attacker-secret");
      const req = makeRequest(body, forgedSig);

      const res = await calcomPost(req);
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "invalid signature" });
    });

    it("rejects malformed or tampered JSON payloads", async () => {
      const rawTampered = '{"triggerEvent": "BOOKING_CONFIRMED", "uid": ';
      const sig = sign(rawTampered);
      const req = new NextRequest("http://localhost/api/webhooks/calcom", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cal-signature-256": sig,
        },
        body: rawTampered,
      });

      const res = await calcomPost(req);
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "invalid json" });
    });
  });

  describe("Booking Lifecycle & Data Integrity", () => {
    it("safely accepts confirmed booking and normalizes attendee emails to lowercase", async () => {
      mocks.single.mockResolvedValue({ data: { id: "00000000-0000-4000-8000-000000000001" } });
      mocks.maybeSingle.mockResolvedValue({ data: { id: "00000000-0000-4000-8000-000000000002" } });

      const body = {
        triggerEvent: "BOOKING_CONFIRMED",
        uid: "valid-booking-uid-100",
        payload: {
          startTime: "2026-11-10T14:00:00Z",
          endTime: "2026-11-10T14:30:00Z",
          attendeeName: "Test Lead",
          attendeeEmail: "  TEST.LEAD@EXAMPLE.COM  ",
          attendeeTimezone: "Asia/Dhaka",
          eventType: { slug: "discovery_call" },
        },
      };

      const res = await calcomPost(makeRequest(body));
      expect(res.status).toBe(200);

      expect(mocks.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          calcom_booking_uid: "valid-booking-uid-100",
          attendee_email: "test.lead@example.com",
          status: "confirmed",
        }),
        { onConflict: "calcom_booking_uid" },
      );
    });

    it("rejects confirmed bookings with missing meeting type or required time boundaries", async () => {
      mocks.single.mockResolvedValue({ data: null }); // meeting type not found

      const incompleteBody = {
        triggerEvent: "BOOKING_CONFIRMED",
        uid: "incomplete-uid",
        payload: {
          attendeeEmail: "test@example.com",
          eventType: { slug: "nonexistent_event_type" },
        },
      };

      const res = await calcomPost(makeRequest(incompleteBody));
      expect(res.status).toBe(422);
      await expect(res.json()).resolves.toEqual({ error: "incomplete payload" });
    });
  });
});
