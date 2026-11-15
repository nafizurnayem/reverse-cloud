import { NextRequest, NextResponse } from "next/server";
import { CalcomBookingError, cancelCalcomBooking } from "@/lib/calcom";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return json({ ok: false, code: "invalid_appointment" }, 400);

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return json({ ok: false, code: "authentication_required" }, 401);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (clientError) return json({ ok: false, code: "cancellation_unavailable" }, 503);
  if (!client) return json({ ok: false, code: "appointment_not_found" }, 404);

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id,client_id,proposal_id,calcom_booking_uid,starts_at,status")
    .eq("id", id)
    .eq("client_id", client.id)
    .in("status", ["confirmed", "rescheduled"])
    .maybeSingle();
  if (meetingError) return json({ ok: false, code: "cancellation_unavailable" }, 503);
  if (!meeting) return json({ ok: false, code: "appointment_not_found" }, 404);
  if (Date.parse(meeting.starts_at) <= Date.now()) {
    return json({ ok: false, code: "cancellation_closed" }, 409);
  }

  const apiKey = process.env.CALCOM_API_KEY?.trim();
  if (!apiKey) return json({ ok: false, code: "cancellation_not_configured" }, 503);

  try {
    await cancelCalcomBooking({
      apiKey,
      bookingUid: meeting.calcom_booking_uid,
      reason: "Client cancelled from Reverse Cloud portal",
      signal: request.signal,
    });
  } catch (error) {
    if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      return json({ ok: false, code: "cancellation_timeout" }, 504);
    }
    if (error instanceof CalcomBookingError) {
      console.error("Cal.com cancellation rejected", { status: error.status });
    }
    return json({ ok: false, code: "cancellation_unavailable" }, 502);
  }

  const admin = createAdminClient();
  const updated = await admin
    .from("meetings")
    .update({ status: "cancelled" })
    .eq("id", meeting.id)
    .eq("client_id", meeting.client_id)
    .eq("calcom_booking_uid", meeting.calcom_booking_uid)
    .in("status", ["confirmed", "rescheduled"])
    .select("id")
    .maybeSingle();

  let proposalUpdateFailed = false;
  if (!updated.error && updated.data && meeting.proposal_id) {
    const proposal = await admin
      .from("booking_proposals")
      .update({ status: "cancelled" })
      .eq("id", meeting.proposal_id);
    proposalUpdateFailed = Boolean(proposal.error);
  }

  if (updated.error || !updated.data || proposalUpdateFailed) {
    // Cal.com already accepted the cancellation. Its signed webhook can still
    // deactivate the local row, so do not encourage a duplicate cancellation.
    console.error("Cancelled booking could not be synchronized to the local database");
    return json({ ok: true, synchronizationPending: true }, 202);
  }

  return json({ ok: true }, 200);
}
