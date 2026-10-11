import { NextRequest, NextResponse } from "next/server";
import { validateLeadPayload } from "@/lib/leads/values";
import { limitContactRequests, requestIp, type RateLimitResult } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

function response(body: Record<string, unknown>, status: number, rate?: RateLimitResult) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (rate) {
    headers.set("x-ratelimit-limit", String(rate.limit));
    headers.set("x-ratelimit-remaining", String(rate.remaining));
    headers.set("x-ratelimit-reset", String(rate.reset));
    if (!rate.allowed) headers.set("retry-after", String(Math.max(1, rate.reset - Math.floor(Date.now() / 1000))));
  }
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 24_000) return response({ ok: false, code: "payload_too_large" }, 413);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return response({ ok: false, code: "invalid_json" }, 400);
  }

  const validated = validateLeadPayload(input);
  if (!validated.ok) {
    if (validated.code === "spam") return response({ ok: true }, 201);
    return response({ ok: false, code: validated.code }, 400);
  }

  const ip = requestIp(request.headers);
  let rate: RateLimitResult;
  try {
    rate = await limitContactRequests(ip);
  } catch {
    return response({ ok: false, code: "protection_unavailable" }, 503);
  }
  if (!rate.allowed) return response({ ok: false, code: "rate_limited" }, 429, rate);

  const challenge = await verifyTurnstile(validated.data.turnstileToken, ip);
  if (!challenge.success) return response({ ok: false, code: "turnstile_failed" }, 400, rate);

  const staffEmail = process.env.STAFF_NOTIFICATION_EMAIL?.trim();
  const telegramChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!staffEmail || !telegramChatId) {
    return response({ ok: false, code: "notifications_unavailable" }, 503, rate);
  }

  let error: { code?: string } | null;
  try {
    const admin = createAdminClient();
    const result = await admin.rpc("create_contact_lead", {
      p_name: validated.data.name,
      p_email: validated.data.email,
      p_phone: validated.data.phone,
      p_company: validated.data.company,
      p_country: validated.data.country,
      p_preferred_locale: validated.data.locale,
      p_message: validated.data.message,
      p_service_id: validated.data.serviceId,
      p_utm: validated.data.utm,
      p_staff_email: staffEmail,
      p_telegram_chat_id: telegramChatId,
    });
    error = result.error;
  } catch {
    return response({ ok: false, code: "save_failed" }, 503, rate);
  }
  if (error) {
    const status = error.code === "23503" ? 400 : 500;
    return response({ ok: false, code: status === 400 ? "invalid_service" : "save_failed" }, status, rate);
  }

  return response({ ok: true }, 201, rate);
}
