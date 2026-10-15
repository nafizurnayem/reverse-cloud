/**
 * Cal.com webhook handler — /api/webhooks/calcom
 *
 * Events handled:
 *   BOOKING_CONFIRMED    → upsert a meeting row
 *   BOOKING_RESCHEDULED  → update starts_at / ends_at / status
 *   BOOKING_CANCELLED    → update status to 'cancelled'
 *   BOOKING_NO_SHOW      → update status to 'no_show'
 *
 * Security:
 *   - HMAC-SHA256 signature verified via CALCOM_WEBHOOK_SECRET (raw body).
 *   - DB write via service_role (bypasses RLS) — clients/staff cannot trigger
 *     this path directly.
 *   - All unknown event types are acknowledged (200) and discarded.
 */

import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

// ------------------------------------------------------------------ helpers

function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.CALCOM_WEBHOOK_SECRET ?? "";
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// --------------------------------------------------------- status mapping

type CalcomTrigger =
  | "BOOKING_CONFIRMED"
  | "BOOKING_CREATED"
  | "BOOKING_PAID"
  | "BOOKING_RESCHEDULED"
  | "BOOKING_CANCELLED"
  | "BOOKING_CANCELED"
  | "BOOKING_REJECTED"
  | "BOOKING_NO_SHOW"
  | "BOOKING_NO_SHOW_UPDATED"
  | string;

function triggerToStatus(trigger: CalcomTrigger): "confirmed" | "rescheduled" | "cancelled" | "no_show" | null {
  switch (trigger) {
    case "BOOKING_CONFIRMED":
    case "BOOKING_CREATED":
    case "BOOKING_PAID":
      return "confirmed";
    case "BOOKING_RESCHEDULED":
      return "rescheduled";
    case "BOOKING_CANCELLED":
    case "BOOKING_CANCELED":
    case "BOOKING_REJECTED":
      return "cancelled";
    case "BOOKING_NO_SHOW":
    case "BOOKING_NO_SHOW_UPDATED":
      return "no_show";
    default:
      return null; // All other events (meeting started/ended, forms, recordings) are accepted with 200 OK
  }
}

// -------------------------------------------------------------------- POST

interface CalcomAttendee {
  name?: string;
  email?: string;
  timeZone?: string;
}

interface CalcomPayload {
  triggerEvent?: string;
  uid?: string;
  booking?: { uid?: string };
  payload?: CalcomPayload;
  eventType?: { slug?: string };
  attendeeName?: string;
  attendeeEmail?: string;
  attendee_email?: string;
  email?: string;
  attendeeTimezone?: string;
  startTime?: string;
  endTime?: string;
  responses?: { email?: { value?: string } };
  attendees?: CalcomAttendee[];
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  // ── 1. Read raw body for signature verification
  const rawBody = await req.text();

  // ── 2. Verify HMAC signature
  const sig = req.headers.get("x-cal-signature-256") ?? "";
  if (!verifySignature(rawBody, sig)) {
    console.error("[calcom-webhook] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // ── 3. Parse JSON
  let payload: CalcomPayload;
  try {
    payload = JSON.parse(rawBody) as CalcomPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const trigger = (payload.triggerEvent ?? "") as CalcomTrigger;
  const bookingUid = (payload.uid ?? payload.booking?.uid ?? "") as string;
  const booking = (payload.payload ?? payload) as CalcomPayload;

  if (!bookingUid) {
    return NextResponse.json({ error: "missing uid" }, { status: 400 });
  }

  // ── 4. Map trigger to DB status (unknown events are silently accepted)
  const status = triggerToStatus(trigger);
  if (!status) {
    return NextResponse.json({ ok: true, ignored: trigger });
  }

  const supabase = serviceClient();

  // ── 5. Resolve the meeting_type_id from Cal.com event-type slug/title
  //       Cal.com includes eventType.slug which matches our meeting_types.key
  const eventTypeSlug = booking.eventType?.slug ?? "";

  let meetingTypeId: string | null = null;
  if (eventTypeSlug) {
    const res = await supabase
      .from("meeting_types")
      .select("id")
      .eq("key", eventTypeSlug)
      .single();
    meetingTypeId = res?.data?.id ?? null;
  }

  // ── 6. On confirmed/rescheduled: resolve optional client link
  let clientId: string | null = null;
  const attendeeEmail = (
    booking.attendeeEmail
    ?? booking.attendee_email
    ?? booking.email
    ?? booking.responses?.email?.value
    ?? booking.attendees?.[0]?.email
    ?? ""
  ) as string;
  const attendeeEmailStr = typeof attendeeEmail === "string" ? attendeeEmail : "";

  if (attendeeEmailStr) {
    const res = await supabase
      .from("clients")
      .select("id")
      .eq("email", attendeeEmailStr.toLowerCase().trim())
      .maybeSingle();
    clientId = res?.data?.id ?? null;
  }

  // ── 7. Build the meeting row
  const attendeeName =
    booking.attendeeName
    ?? booking.attendees?.[0]?.name
    ?? "Unknown";

  const attendeeTimezone =
    booking.attendeeTimezone
    ?? booking.attendees?.[0]?.timeZone
    ?? "UTC";

  const startsAt = booking.startTime;
  const endsAt   = booking.endTime;

  // ── 8. BOOKING_CREATED / BOOKING_CONFIRMED → upsert; others → update status only
  if (trigger === "BOOKING_CONFIRMED" || trigger === "BOOKING_CREATED" || trigger === "BOOKING_PAID") {
    if (!meetingTypeId || !startsAt || !endsAt) {
      console.error("[calcom-webhook] missing required fields for CREATED/CONFIRMED", {
        meetingTypeId, startsAt, endsAt,
      });
      return NextResponse.json({ error: "incomplete payload" }, { status: 422 });
    }

    const { error } = await supabase.from("meetings").upsert(
      {
        calcom_booking_uid: bookingUid,
        meeting_type_id:    meetingTypeId,
        client_id:          clientId,
        attendee_name:      attendeeName,
        attendee_email:     attendeeEmailStr.toLowerCase().trim(),
        attendee_timezone:  attendeeTimezone,
        starts_at:          startsAt,
        ends_at:            endsAt,
        status:             "confirmed",
        calcom_payload:     payload,
      },
      { onConflict: "calcom_booking_uid" },
    );

    if (error) {
      console.error("[calcom-webhook] upsert error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, uid: bookingUid });
  }

  // RESCHEDULED — update time + status
  if (trigger === "BOOKING_RESCHEDULED") {
    const { error } = await supabase
      .from("meetings")
      .update({
        status:         "rescheduled",
        starts_at:      startsAt,
        ends_at:        endsAt,
        calcom_payload: payload,
      })
      .eq("calcom_booking_uid", bookingUid);

    if (error) {
      console.error("[calcom-webhook] reschedule error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, uid: bookingUid });
  }

  // CANCELLED / NO_SHOW — update status only
  const { error } = await supabase
    .from("meetings")
    .update({ status, calcom_payload: payload })
    .eq("calcom_booking_uid", bookingUid);

  if (error) {
    console.error("[calcom-webhook] status update error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, uid: bookingUid });
}
