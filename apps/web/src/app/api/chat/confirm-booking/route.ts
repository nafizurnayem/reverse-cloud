import { NextRequest, NextResponse } from "next/server";
import {
  CalcomBookingError,
  createCalcomBooking,
  sha256,
  type CreatedCalcomBooking,
} from "@/lib/calcom";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const maxRequestBytes = 4_096;

type ConfirmedProposal = {
  proposal_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  intake_summary: string | null;
  meeting_type_id: string;
  meeting_type_key: string;
  meeting_name: string;
  calcom_event_type_id: string;
};

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max
    ? value.trim()
    : null;
}

function confirmedProposal(value: unknown): ConfirmedProposal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const proposalId = text(row.proposal_id, 36);
  const startsAt = text(row.starts_at, 50);
  const endsAt = text(row.ends_at, 50);
  const timezone = text(row.timezone, 100);
  const meetingTypeId = text(row.meeting_type_id, 36);
  const meetingTypeKey = text(row.meeting_type_key, 50);
  const meetingName = text(row.meeting_name, 100);
  const eventTypeId = text(row.calcom_event_type_id, 30);
  if (
    !proposalId || !uuidPattern.test(proposalId) || !startsAt || !endsAt ||
    !timezone || !meetingTypeId || !meetingTypeKey || !meetingName ||
    !eventTypeId || !/^\d+$/.test(eventTypeId)
  ) {
    return null;
  }
  if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt))) return null;
  return {
    proposal_id: proposalId,
    status: text(row.status, 30) ?? "confirmed",
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    timezone,
    intake_summary: text(row.intake_summary, 5_000),
    meeting_type_id: meetingTypeId,
    meeting_type_key: meetingTypeKey,
    meeting_name: meetingName,
    calcom_event_type_id: eventTypeId,
  };
}

function attendeeName(email: string, metadata: Record<string, unknown> | undefined) {
  for (const key of ["full_name", "name", "display_name"]) {
    const candidate = text(metadata?.[key], 200);
    if (candidate) return candidate;
  }
  return email.split("@")[0].slice(0, 200) || "Reverse Cloud Client";
}

function rpcFailure(error: { code?: string; message?: string } | null) {
  if (error?.code === "P0002" || error?.code === "42501") {
    return json({ ok: false, code: "not_found", message: "Booking proposal not found." }, 404);
  }
  if (error?.code === "22023") {
    const expired = error.message?.includes("expired") === true;
    return json({
      ok: false,
      code: expired ? "expired" : "proposal_unavailable",
      message: expired
        ? "This booking proposal has expired. Please select a new slot."
        : "This booking proposal is no longer available. Please select a new slot.",
    }, 409);
  }
  return json({ ok: false, code: "booking_unavailable", message: "Booking is temporarily unavailable." }, 503);
}

async function markProposalFailed(proposalId: string, userId: string) {
  try {
    const admin = createAdminClient();
    await admin
      .from("booking_proposals")
      .update({ status: "failed" })
      .eq("id", proposalId)
      .eq("confirmed_by", userId)
      .eq("status", "confirmed");
  } catch {
    // The stable API error below is more useful to the caller than cleanup details.
  }
}

async function recordConfirmedBooking(
  proposal: ConfirmedProposal,
  booking: CreatedCalcomBooking,
  attendee: { name: string; email: string; timeZone: string },
) {
  const occurredAt = new Date().toISOString();
  const normalized = JSON.stringify({
    uid: booking.uid,
    proposalId: proposal.proposal_id,
    start: booking.start,
    end: booking.end,
  });
  const admin = createAdminClient();
  const result = await admin.rpc("process_calcom_webhook_delivery", {
    p_delivery_key: sha256(`booking-route:${normalized}`),
    p_trigger_event: "BOOKING_CREATED",
    p_occurred_at: occurredAt,
    p_booking_uid: booking.uid,
    p_payload_sha256: sha256(normalized),
    p_event_type_id: proposal.calcom_event_type_id,
    p_meeting_type_key: proposal.meeting_type_key,
    p_proposal_id: proposal.proposal_id,
    p_attendee_name: attendee.name,
    p_attendee_email: attendee.email,
    p_attendee_timezone: attendee.timeZone,
    p_starts_at: booking.start,
    p_ends_at: booking.end,
  });
  if (result.error) throw new Error("booking_persistence_failed");
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) {
    return json({ ok: false, code: "payload_too_large", message: "Request payload is too large." }, 413);
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return json({
      ok: false,
      code: "unauthorized",
      message: "Authentication required to confirm booking.",
    }, 401);
  }

  const email = auth.user.email?.trim().toLowerCase() ?? "";
  if (!emailPattern.test(email)) {
    return json({ ok: false, code: "account_email_required", message: "A verified account email is required." }, 409);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, code: "invalid_json", message: "Invalid request payload." }, 400);
  }
  const proposalId = body && typeof body === "object" && !Array.isArray(body)
    ? text((body as Record<string, unknown>).proposalId, 36)
    : null;
  if (!proposalId || !uuidPattern.test(proposalId)) {
    return json({ ok: false, code: "invalid_proposal_id", message: "Invalid booking proposal." }, 400);
  }

  const apiKey = process.env.CALCOM_API_KEY?.trim();
  if (!apiKey) {
    return json({ ok: false, code: "scheduling_not_configured", message: "Booking is temporarily unavailable." }, 503);
  }

  const claim = await supabase.rpc("confirm_booking_proposal", { p_proposal_id: proposalId });
  if (claim.error) return rpcFailure(claim.error);
  const proposal = confirmedProposal(claim.data);
  if (!proposal) {
    await markProposalFailed(proposalId, auth.user.id);
    return json({ ok: false, code: "booking_unavailable", message: "Booking is temporarily unavailable." }, 503);
  }

  const metadata = auth.user.user_metadata && typeof auth.user.user_metadata === "object"
    ? auth.user.user_metadata as Record<string, unknown>
    : undefined;
  const attendee = {
    name: attendeeName(email, metadata),
    email,
    timeZone: proposal.timezone,
    language: (metadata?.locale === "bn" ? "bn" : "en") as "en" | "bn",
  };

  let booking: CreatedCalcomBooking;
  try {
    booking = await createCalcomBooking({
      apiKey,
      eventTypeId: proposal.calcom_event_type_id,
      start: proposal.starts_at,
      attendee,
      proposalId: proposal.proposal_id,
      signal: request.signal,
    });
  } catch (error) {
    await markProposalFailed(proposal.proposal_id, auth.user.id);
    const status = error instanceof CalcomBookingError ? error.status : null;
    if (status !== null && [400, 404, 409, 422].includes(status)) {
      return json({
        ok: false,
        code: "slot_unavailable",
        message: "This slot is no longer available. Please select another time.",
      }, 409);
    }
    if (error instanceof Error && error.name === "AbortError") {
      return json({ ok: false, code: "scheduling_timeout", message: "Booking timed out. Please try another slot." }, 504);
    }
    return json({ ok: false, code: "scheduling_unavailable", message: "Booking is temporarily unavailable." }, 502);
  }

  try {
    await recordConfirmedBooking(proposal, booking, attendee);
  } catch {
    // Cal.com is the source of truth once it accepted the booking. Its signed
    // webhook retries the same persistence contract, so never invite a duplicate.
  }

  return json({
    ok: true,
    proposalId: proposal.proposal_id,
    status: "confirmed",
    booking: {
      uid: booking.uid,
      startsAt: booking.start,
      endsAt: booking.end,
      meetingUrl: booking.meetingUrl,
    },
  }, 200);
}
