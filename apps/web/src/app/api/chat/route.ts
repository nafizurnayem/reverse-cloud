import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  chatSession,
  chatSessionCookie,
  type ChatSession,
} from "@/lib/chat/session";
import { validateChatPayload } from "@/lib/chat/values";
import { limitChatRequests, requestIp, type RateLimitResult } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const maxRequestBytes = 625_000;

function rateHeaders(rate?: RateLimitResult) {
  const headers = new Headers({
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  if (rate) {
    headers.set("x-ratelimit-limit", String(rate.limit));
    headers.set("x-ratelimit-remaining", String(rate.remaining));
    headers.set("x-ratelimit-reset", String(rate.reset));
    if (!rate.allowed) {
      headers.set("retry-after", String(Math.max(1, rate.reset - Math.floor(Date.now() / 1000))));
    }
  }
  return headers;
}

function attachSession(response: NextResponse, session?: ChatSession) {
  if (session?.fresh) {
    response.cookies.set(chatSessionCookie, session.token, {
      httpOnly: true,
      maxAge: Math.max(1, session.expiresAt - Math.floor(Date.now() / 1000)),
      path: "/api/chat",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

function json(
  body: Record<string, unknown>,
  status: number,
  rate?: RateLimitResult,
  session?: ChatSession,
) {
  return attachSession(NextResponse.json(body, { status, headers: rateHeaders(rate) }), session);
}

export async function POST(request: NextRequest) {
  const serviceUrl = process.env.AI_SERVICE_URL?.trim();
  const serviceSecret = process.env.AI_HMAC_SECRET_CURRENT;
  if (!serviceUrl || !serviceSecret) {
    return json({ error: "Chat service is not configured", code: "not_configured" }, 503);
  }

  let session: ChatSession;
  try {
    session = chatSession(request.cookies.get(chatSessionCookie)?.value);
  } catch {
    return json({ error: "Chat session is not configured", code: "not_configured" }, 503);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) {
    return json({ error: "Chat payload is too large", code: "payload_too_large" }, 413);
  }

  let input: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > maxRequestBytes) {
      return json({ error: "Chat payload is too large", code: "payload_too_large" }, 413);
    }
    input = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON", code: "invalid_json" }, 400);
  }

  const validated = validateChatPayload(input);
  if (!validated.ok) {
    return json({ error: "Invalid chat request", code: validated.code }, 400);
  }

  const ip = requestIp(request.headers);
  let rate: RateLimitResult;
  try {
    rate = await limitChatRequests(ip);
  } catch {
    return json({ error: "Chat protection is unavailable", code: "protection_unavailable" }, 503);
  }
  if (!rate.allowed) {
    return json({ error: "Too many chat requests", code: "rate_limited" }, 429, rate);
  }

  if (session.fresh) {
    const token = request.headers.get("x-turnstile-token")?.trim() ?? "";
    if (!token) {
      return json({ error: "Complete the security check", code: "turnstile_required" }, 403, rate);
    }
    const challenge = await verifyTurnstile(token, ip, { expectedAction: "chat" });
    if (!challenge.success) {
      if (challenge.errors.some((code) => code === "missing-secret" || code === "siteverify-unavailable")) {
        return json({ error: "Chat protection is unavailable", code: "protection_unavailable" }, 503, rate);
      }
      return json({ error: "Security check failed", code: "turnstile_failed" }, 403, rate);
    }
  }

  const body = JSON.stringify({ ...validated.data, conversation_id: session.id });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", serviceSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  let upstream: Response;
  try {
    upstream = await fetch(`${serviceUrl.replace(/\/$/, "")}/v1/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ai-timestamp": timestamp,
        "x-ai-signature": signature,
      },
      body,
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return json({ error: "Chat service unavailable", code: "service_unavailable" }, 502, rate, session);
  }

  if (!upstream.body) {
    return json({ error: "Chat service returned an empty response", code: "empty_response" }, 502, rate, session);
  }

  const headers = rateHeaders(rate);
  headers.set("content-type", upstream.headers.get("content-type") ?? "text/event-stream");
  headers.set("cache-control", upstream.ok ? "no-cache, no-transform" : "no-store");
  if (upstream.ok) headers.set("x-accel-buffering", "no");
  return attachSession(new NextResponse(upstream.body, { status: upstream.status, headers }), session);
}
