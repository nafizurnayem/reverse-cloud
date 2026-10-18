import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          ok: false,
          code: "unauthorized",
          message: "Authentication required to confirm booking.",
        },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          code: "invalid_json",
          message: "Invalid request payload.",
        },
        { status: 400 },
      );
    }

    const proposalId =
      typeof body === "object" && body !== null && "proposalId" in body
        ? String((body as { proposalId: unknown }).proposalId).trim()
        : "";

    if (!proposalId) {
      return NextResponse.json(
        {
          ok: false,
          code: "missing_proposal_id",
          message: "Missing required proposalId parameter.",
        },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();

    // Perform atomic status transition: open -> confirmed (if not expired)
    const { data: updatedProposal, error: updateError } = await supabase
      .from("booking_proposals")
      .update({
        status: "confirmed",
        confirmed_by: user.id,
        confirmed_at: nowIso,
      })
      .eq("id", proposalId)
      .eq("status", "open")
      .gt("expires_at", nowIso)
      .select("id, status, starts_at, ends_at, timezone, meeting_type_id")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          ok: false,
          code: "database_error",
          message: updateError.message,
        },
        { status: 500 },
      );
    }

    if (!updatedProposal) {
      // Query to check status: already confirmed or expired
      const { data: existing } = await supabase
        .from("booking_proposals")
        .select("id, status, expires_at")
        .eq("id", proposalId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json(
          {
            ok: false,
            code: "not_found",
            message: "Booking proposal not found.",
          },
          { status: 404 },
        );
      }

      if (existing.status === "confirmed") {
        return NextResponse.json(
          {
            ok: true,
            proposalId: existing.id,
            status: "confirmed",
            alreadyConfirmed: true,
          },
          { status: 200 },
        );
      }

      if (
        existing.status === "expired" ||
        new Date(existing.expires_at) <= new Date()
      ) {
        return NextResponse.json(
          {
            ok: false,
            code: "expired",
            message: "This booking proposal has expired. Please select a new slot.",
          },
          { status: 410 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          code: "invalid_status",
          message: `Booking proposal is currently '${existing.status}' and cannot be confirmed.`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        proposalId: updatedProposal.id,
        status: "confirmed",
        proposal: updatedProposal,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "internal_error",
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
