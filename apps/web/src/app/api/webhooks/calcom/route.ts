import { NextRequest, NextResponse } from "next/server";
import { parseCalcomWebhook, readLimitedBody, sha256, verifyCalcomSignature, webhookSecrets } from "@/lib/calcom";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const handled = new Set([
  "BOOKING_CREATED", "BOOKING_CONFIRMED", "BOOKING_PAID", "BOOKING_RESCHEDULED",
  "BOOKING_CANCELLED", "BOOKING_CANCELED", "BOOKING_REJECTED", "BOOKING_NO_SHOW", "BOOKING_NO_SHOW_UPDATED",
]);
const needsDetails = new Set(["BOOKING_CREATED", "BOOKING_CONFIRMED", "BOOKING_PAID", "BOOKING_RESCHEDULED"]);

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const secrets = webhookSecrets();
  if (secrets.length === 0) return json({ ok: false, code: "webhook_not_configured" }, 503);
  let rawBody: string;
  try { rawBody = await readLimitedBody(request); }
  catch { return json({ ok: false, code: "payload_too_large" }, 413); }
  if (!verifyCalcomSignature(rawBody, request.headers.get("x-cal-signature-256"), secrets)) {
    return json({ ok: false, code: "invalid_signature" }, 401);
  }
  let input: unknown;
  try { input = JSON.parse(rawBody); }
  catch { return json({ ok: false, code: "invalid_json" }, 400); }
  const event = parseCalcomWebhook(input);
  if (!event) return json({ ok: false, code: "invalid_event" }, 400);
  if (!handled.has(event.triggerEvent)) return json({ ok: true, ignored: event.triggerEvent });
  if (!event.bookingUid) return json({ ok: false, code: "missing_booking_uid" }, 400);
  if (needsDetails.has(event.triggerEvent)
    && (!event.startsAt || !event.endsAt || !event.attendeeEmail || !event.attendeeName
      || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(event.attendeeEmail))) {
    return json({ ok: false, code: "incomplete_event" }, 422);
  }
  const payloadHash = sha256(rawBody);
  const deliveryKey = sha256([event.triggerEvent, event.bookingUid, event.createdAt].join("."));

  // Ensure attendee phone from webhook is synced into leads table
  if (event.attendeeEmail && event.attendeePhone) {
    try {
      const admin = createAdminClient();
      const existing = await admin
        .from("leads")
        .select("id,phone")
        .eq("email", event.attendeeEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing.data?.id) {
        if (!existing.data.phone) {
          await admin
            .from("leads")
            .update({ phone: event.attendeePhone, updated_at: new Date().toISOString() })
            .eq("id", existing.data.id);
        }
      } else {
        await admin
          .from("leads")
          .insert({
            name: event.attendeeName || "Cal.com Attendee",
            email: event.attendeeEmail,
            phone: event.attendeePhone,
            source: "chat",
            status: "new",
            preferred_locale: "en",
            message: `Booked via Cal.com [UID: ${event.bookingUid}]`,
            consent_at: new Date().toISOString(),
          });
      }
    } catch {
      // Non-blocking
    }
  }

  try {
    const result = await createAdminClient().rpc("process_calcom_webhook_delivery", {
      p_delivery_key: deliveryKey, p_trigger_event: event.triggerEvent, p_occurred_at: event.createdAt,
      p_booking_uid: event.bookingUid, p_payload_sha256: payloadHash,
      p_event_type_id: event.eventTypeId, p_meeting_type_key: event.meetingTypeKey,
      p_proposal_id: event.proposalId, p_attendee_name: event.attendeeName,
      p_attendee_email: event.attendeeEmail, p_attendee_timezone: event.attendeeTimeZone ?? "UTC",
      p_starts_at: event.startsAt, p_ends_at: event.endsAt,
    });
    if (result.error) return json({ ok: false, code: "processing_failed" }, 503);
    return json({ ok: true, duplicate: result.data === false });
  } catch {
    return json({ ok: false, code: "processing_failed" }, 503);
  }
}
