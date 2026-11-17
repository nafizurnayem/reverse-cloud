import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  chatSession,
  chatSessionCookie,
  type ChatSession,
} from "@/lib/chat/session";
import { validateChatPayload } from "@/lib/chat/values";
import { localPreviewChat } from "@/lib/chat/local-preview";
import { chatSiteContext, resolveChatPageContext } from "@/lib/chat/page-context";
import { directPublicKnowledgeReply, isServiceListRequest } from "@/lib/chat/public-knowledge";
import { restrictedChatReply } from "@/lib/chat/response-policy";
import { getPublishedServices } from "@/lib/services-server";
import {
  limitChatRequests,
  requestIp,
  type ChatRateLimitResult,
  type RateLimitResult,
} from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const maxRequestBytes = 625_000;
const defaultConnectTimeoutMs = 10_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authenticatedClientId() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    return !error && typeof data?.id === "string" && uuidPattern.test(data.id)
      ? data.id
      : null;
  } catch {
    // Chat remains public, but project-status access fails closed without a verified client ID.
    return null;
  }
}

function connectTimeoutMs() {
  const raw = process.env.AI_CHAT_CONNECT_TIMEOUT_MS?.trim();
  if (!raw) return defaultConnectTimeoutMs;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 30_000) {
    throw new Error("AI_CHAT_CONNECT_TIMEOUT_MS must be between 1000 and 30000.");
  }
  return value;
}

function primaryRate(rate: ChatRateLimitResult): RateLimitResult {
  if (!rate.session.allowed) return rate.session;
  if (!rate.ip.allowed) return rate.ip;
  return rate.session;
}

function rateHeaders(rate?: ChatRateLimitResult) {
  const headers = new Headers({
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  if (rate) {
    const primary = primaryRate(rate);
    headers.set("x-ratelimit-limit", String(primary.limit));
    headers.set("x-ratelimit-remaining", String(primary.remaining));
    headers.set("x-ratelimit-reset", String(primary.reset));
    headers.set("x-ratelimit-ip-limit", String(rate.ip.limit));
    headers.set("x-ratelimit-ip-remaining", String(rate.ip.remaining));
    headers.set("x-ratelimit-ip-reset", String(rate.ip.reset));
    headers.set("x-ratelimit-session-limit", String(rate.session.limit));
    headers.set("x-ratelimit-session-remaining", String(rate.session.remaining));
    headers.set("x-ratelimit-session-reset", String(rate.session.reset));
    if (!rate.allowed) {
      const reset = Math.max(
        rate.ip.allowed ? 0 : rate.ip.reset,
        rate.session.allowed ? 0 : rate.session.reset,
      );
      headers.set("retry-after", String(Math.max(1, reset - Math.floor(Date.now() / 1000))));
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
  rate?: ChatRateLimitResult,
  session?: ChatSession,
) {
  return attachSession(NextResponse.json(body, { status, headers: rateHeaders(rate) }), session);
}

export async function POST(request: NextRequest) {
  if (process.env.LOCAL_OLLAMA_PREVIEW === "true") return localPreviewChat(request);

  const serviceUrl = process.env.AI_SERVICE_URL?.trim();
  const serviceSecret = process.env.AI_HMAC_SECRET_CURRENT;
  let timeoutMs: number;
  try {
    timeoutMs = connectTimeoutMs();
  } catch {
    return json({ error: "Chat service is not configured", code: "not_configured" }, 503);
  }
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
  let rate: ChatRateLimitResult;
  try {
    rate = await limitChatRequests(ip, session.id);
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

  const latestUserMessage = validated.data.messages.findLast((message) => message.role === "user")?.content ?? "";
  if (!restrictedChatReply(latestUserMessage, validated.data.locale) && isServiceListRequest(latestUserMessage)) {
    const reply = directPublicKnowledgeReply(latestUserMessage, validated.data.locale, await getPublishedServices());
    return json({ reply }, 200, rate, session);
  }

  const { page, ...chatInput } = validated.data;
  const [clientId, pageContext] = await Promise.all([
    authenticatedClientId(),
    resolveChatPageContext(page?.path, chatInput.locale),
  ]);
  const body = JSON.stringify({
    ...chatInput,
    conversation_id: session.id,
    ...(clientId ? { client_id: clientId } : {}),
    ...(pageContext ? { page_context: pageContext } : {}),
    ...chatSiteContext(),
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", serviceSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  let upstream: Response;
  let timedOut = false;
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMs);
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
      signal: AbortSignal.any([request.signal, timeoutController.signal]),
    });
  } catch {
    if (request.signal.aborted) {
      return json({ error: "Client disconnected", code: "client_disconnected" }, 499, rate, session);
    }
    if (timedOut) {
      return json({ error: "Chat service timed out", code: "service_timeout" }, 504, rate, session);
    }
    return json({ error: "Chat service unavailable", code: "service_unavailable" }, 502, rate, session);
  } finally {
    clearTimeout(timeout);
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
