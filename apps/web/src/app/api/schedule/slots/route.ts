import { NextRequest, NextResponse } from "next/server";
import { fetchAvailableSlots, parseScheduleQuery } from "@/lib/calcom";
import { limitScheduleRequests, requestIp, type RateLimitResult } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status: number, rate?: RateLimitResult) {
  const headers = new Headers({ "cache-control": "private, no-store" });
  if (rate) {
    headers.set("x-ratelimit-limit", String(rate.limit)); headers.set("x-ratelimit-remaining", String(rate.remaining));
    headers.set("x-ratelimit-reset", String(rate.reset));
    if (!rate.allowed) headers.set("retry-after", String(Math.max(1, rate.reset - Math.floor(Date.now() / 1000))));
  }
  return NextResponse.json(body, { status, headers });
}

export async function GET(request: NextRequest) {
  const parsed = parseScheduleQuery(request.nextUrl.searchParams);
  if (!parsed.ok) return json({ ok: false, code: parsed.code }, 400);
  let rate: RateLimitResult;
  try { rate = await limitScheduleRequests(requestIp(request.headers)); }
  catch { return json({ ok: false, code: "protection_unavailable" }, 503); }
  if (!rate.allowed) return json({ ok: false, code: "rate_limited" }, 429, rate);
  const apiKey = process.env.CALCOM_API_KEY?.trim();
  if (!apiKey) return json({ ok: false, code: "scheduling_not_configured" }, 503, rate);
  try {
    const supabase = await createClient();
    const result = await supabase.from("meeting_types").select("key,name_en,name_bn,duration_min,calcom_event_type_id")
      .eq("key", parsed.value.meetingType).eq("is_active", true).maybeSingle();
    if (result.error) return json({ ok: false, code: "scheduling_unavailable" }, 503, rate);
    if (!result.data) return json({ ok: false, code: "meeting_type_not_found" }, 404, rate);
    if (!result.data.calcom_event_type_id) return json({ ok: false, code: "meeting_type_not_configured" }, 503, rate);
    const slots = await fetchAvailableSlots({ apiKey, eventTypeId: result.data.calcom_event_type_id,
      start: parsed.value.start, end: parsed.value.end, timeZone: parsed.value.timeZone,
      durationMinutes: result.data.duration_min, signal: request.signal });
    return json({ ok: true, meetingType: { key: result.data.key,
      name: { en: result.data.name_en, bn: result.data.name_bn ?? result.data.name_en },
      durationMinutes: result.data.duration_min }, timeZone: parsed.value.timeZone, slots }, 200, rate);
  } catch (error) {
    if (request.signal.aborted) return json({ ok: false, code: "client_disconnected" }, 499, rate);
    const timeout = error instanceof Error && error.name === "AbortError";
    return json({ ok: false, code: timeout ? "scheduling_timeout" : "scheduling_unavailable" }, timeout ? 504 : 502, rate);
  }
}
