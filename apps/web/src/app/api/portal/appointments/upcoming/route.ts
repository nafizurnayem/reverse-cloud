import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return json({ ok: false, code: "authentication_required" }, 401);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .maybeSingle();
  if (clientError) return json({ ok: false, code: "appointment_unavailable" }, 503);
  if (!client) return json({ ok: true, appointment: null });

  const { data, error } = await supabase
    .from("meetings")
    .select("id,starts_at,ends_at,attendee_timezone,status,meeting_types:meeting_type_id(name_en,name_bn)")
    .eq("client_id", client.id)
    .in("status", ["confirmed", "rescheduled"])
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return json({ ok: false, code: "appointment_unavailable" }, 503);
  if (!data) return json({ ok: true, appointment: null });

  const meetingType = data.meeting_types as unknown as { name_en?: string; name_bn?: string | null } | null;
  return json({
    ok: true,
    appointment: {
      id: data.id,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      timeZone: data.attendee_timezone || "UTC",
      status: data.status,
      meetingTypeNameEn: meetingType?.name_en || "Consultation",
      meetingTypeNameBn: meetingType?.name_bn || null,
    },
  });
}
