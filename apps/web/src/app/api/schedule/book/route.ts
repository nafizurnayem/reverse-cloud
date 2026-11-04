import { NextRequest, NextResponse } from "next/server";
import {
  CalcomBookingError,
  createCalcomBooking,
  fetchAvailableSlots,
  parseScheduleQuery,
  sha256,
} from "@/lib/calcom";
import {
  limitScheduleBookingRequests,
  requestIp,
  type RateLimitResult,
} from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const maxRequestBytes = 16_384;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type BookingInput = {
  meetingType: string;
  start: string;
  end: string;
  timeZone: string;
  name: string;
  email: string;
  company: string | null;
  notes: string | null;
  locale: "en" | "bn";
  turnstileToken: string;
};

function json(body: Record<string, unknown>, status: number, rate?: RateLimitResult) {
  const headers = new Headers({ "cache-control": "private, no-store" });
  if (rate) {
    headers.set("x-ratelimit-limit", String(rate.limit));
    headers.set("x-ratelimit-remaining", String(rate.remaining));
    headers.set("x-ratelimit-reset", String(rate.reset));
    if (!rate.allowed) {
      headers.set("retry-after", String(Math.max(1, rate.reset - Math.floor(Date.now() / 1_000))));
    }
  }
  return NextResponse.json(body, { status, headers });
}

function boundedText(value: unknown, max: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const clean = value.trim();
  if (clean.length > max || (required && clean.length === 0)) return null;
  return clean;
}

function bookingInput(value: unknown): BookingInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const meetingType = boundedText(input.meetingType, 50, true);
  const start = boundedText(input.start, 50, true);
  const end = boundedText(input.end, 50, true);
  const timeZone = boundedText(input.timeZone, 100, true);
  const name = boundedText(input.name, 200, true);
  const email = boundedText(input.email, 320, true)?.toLowerCase() ?? null;
  const company = boundedText(input.company, 200);
  const notes = boundedText(input.notes, 2_000);
  const turnstileToken = boundedText(input.turnstileToken, 2_048, true);
  const locale = input.locale === "bn" ? "bn" : input.locale === "en" ? "en" : null;
  if (
    !meetingType || !start || !end || !timeZone || !name || name.length < 2 ||
    !email || !emailPattern.test(email) || company === null || notes === null ||
    !turnstileToken || !locale
  ) {
    return null;
  }
  const schedule = parseScheduleQuery(new URLSearchParams({ meetingType, start, end, timeZone }));
  if (!schedule.ok) return null;
  return {
    ...schedule.value,
    name,
    email,
    company: company || null,
    notes: notes || null,
    locale,
    turnstileToken,
  };
}

function isSelectedSlotAvailable(
  slots: Array<{ start: string; end: string }>,
  start: string,
  end: string,
) {
  const targetStart = new Date(start).toISOString();
  const targetEnd = new Date(end).toISOString();
  return slots.some((slot) => slot.start === targetStart && slot.end === targetEnd);
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > maxRequestBytes) {
    return json({ ok: false, code: "payload_too_large" }, 413);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }
  const input = bookingInput(raw);
  if (!input) return json({ ok: false, code: "invalid_input" }, 400);

  const ip = requestIp(request.headers);
  let rate: RateLimitResult;
  try {
    rate = await limitScheduleBookingRequests(ip);
  } catch {
    return json({ ok: false, code: "protection_unavailable" }, 503);
  }
  if (!rate.allowed) return json({ ok: false, code: "rate_limited" }, 429, rate);

  const challenge = await verifyTurnstile(input.turnstileToken, ip, {
    expectedAction: "schedule_booking",
  });
  if (!challenge.success) {
    const unavailable = challenge.errors.some(
      (code) => code === "missing-secret" || code === "siteverify-unavailable",
    );
    return json({
      ok: false,
      code: unavailable ? "protection_unavailable" : "turnstile_failed",
    }, unavailable ? 503 : 403, rate);
  }

  const apiKey = process.env.CALCOM_API_KEY?.trim();
  if (!apiKey) return json({ ok: false, code: "scheduling_not_configured" }, 503, rate);

  try {
    const supabase = await createClient();
    const meeting = await supabase
      .from("meeting_types")
      .select("id,key,duration_min,calcom_event_type_id")
      .eq("key", input.meetingType)
      .eq("is_active", true)
      .maybeSingle();
    if (meeting.error) return json({ ok: false, code: "scheduling_unavailable" }, 503, rate);
    if (!meeting.data) return json({ ok: false, code: "meeting_type_not_found" }, 404, rate);
    if (!/^\d+$/.test(meeting.data.calcom_event_type_id ?? "")) {
      return json({ ok: false, code: "meeting_type_not_configured" }, 503, rate);
    }

    const expectedDuration = Number(meeting.data.duration_min) * 60_000;
    if (Date.parse(input.end) - Date.parse(input.start) !== expectedDuration) {
      return json({ ok: false, code: "invalid_duration" }, 400, rate);
    }

    const slots = await fetchAvailableSlots({
      apiKey,
      eventTypeId: meeting.data.calcom_event_type_id,
      start: input.start,
      end: input.end,
      timeZone: input.timeZone,
      durationMinutes: meeting.data.duration_min,
      signal: request.signal,
    });
    if (!isSelectedSlotAvailable(slots, input.start, input.end)) {
      return json({ ok: false, code: "slot_unavailable" }, 409, rate);
    }

    const booking = await createCalcomBooking({
      apiKey,
      eventTypeId: meeting.data.calcom_event_type_id,
      start: input.start,
      attendee: {
        name: input.name,
        email: input.email,
        timeZone: input.timeZone,
        language: input.locale,
      },
      source: "reverse_cloud_schedule",
      metadata: {
        ...(input.company ? { company: input.company } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      },
      signal: request.signal,
    });

    const normalized = JSON.stringify({
      uid: booking.uid,
      start: booking.start,
      end: booking.end,
      email: input.email,
    });
    const admin = createAdminClient();
    const stored = await admin.rpc("process_calcom_webhook_delivery", {
      p_delivery_key: sha256(`schedule-route:${normalized}`),
      p_trigger_event: "BOOKING_CREATED",
      p_occurred_at: new Date().toISOString(),
      p_booking_uid: booking.uid,
      p_payload_sha256: sha256(normalized),
      p_event_type_id: meeting.data.calcom_event_type_id,
      p_meeting_type_key: meeting.data.key,
      p_proposal_id: null,
      p_attendee_name: input.name,
      p_attendee_email: input.email,
      p_attendee_timezone: input.timeZone,
      p_starts_at: booking.start,
      p_ends_at: booking.end,
    });
    if (stored.error) {
      // The signed Cal.com webhook will retry persistence. The real booking must
      // still be reported as successful to prevent an accidental duplicate.
    }

    return json({
      ok: true,
      booking: {
        uid: booking.uid,
        startsAt: booking.start,
        endsAt: booking.end,
        meetingUrl: booking.meetingUrl,
      },
    }, 201, rate);
  } catch (error) {
    if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      return json({ ok: false, code: "scheduling_timeout" }, 504, rate);
    }
    if (error instanceof CalcomBookingError && error.status === 409) {
      return json({ ok: false, code: "slot_unavailable" }, 409, rate);
    }
    if (error instanceof CalcomBookingError) {
      console.error("Cal.com booking rejected", { status: error.status });
    }
    return json({ ok: false, code: "scheduling_unavailable" }, 502, rate);
  }
}
