import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  verify: vi.fn(),
  fetch: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ratelimit", () => ({
  requestIp: () => "192.0.2.20",
  limitChatRequests: mocks.limit,
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: mocks.verify }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { POST } from "../src/app/api/chat/route";

const payload = {
  messages: [{ role: "user", content: "Hello" }],
  locale: "bn",
  conversation_id: "browser-controlled",
  client_id: "99999999-9999-4999-8999-999999999999",
};

function request(
  body: unknown,
  options: { cookie?: string; token?: string; signal?: AbortSignal } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.cookie) headers.set("cookie", `rc_chat_session=${options.cookie}`);
  if (options.token) headers.set("x-turnstile-token", options.token);
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });
}

function allowedRate() {
  return {
    allowed: true,
    ip: { allowed: true, limit: 60, remaining: 59, reset: 1060 },
    session: { allowed: true, limit: 20, remaining: 19, reset: 1060 },
  };
}

beforeEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.stubEnv("AI_SERVICE_URL", "https://ai.example/");
  vi.stubEnv("AI_HMAC_SECRET_CURRENT", "service-secret");
  vi.stubEnv("AI_CHAT_CONNECT_TIMEOUT_MS", "10000");
  vi.stubEnv("CHAT_COOKIE_SECRET", "0123456789abcdef0123456789abcdef");
  mocks.limit.mockResolvedValue(allowedRate());
  mocks.verify.mockResolvedValue({ success: true, errors: [] });
  const clientQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: mocks.maybeSingle,
  };
  clientQuery.select.mockReturnValue(clientQuery);
  clientQuery.eq.mockReturnValue(clientQuery);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.from.mockReturnValue(clientQuery);
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  });
  mocks.fetch.mockResolvedValue(new Response(
    'event: message_start\ndata: {"conversation_id":"id"}\n\n',
    { status: 200, headers: { "content-type": "text/event-stream" } },
  ));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/chat", () => {
  it("establishes a protected cookie session and signs the normalized upstream request", async () => {
    const response = await POST(request(payload, { token: "turnstile-token" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("set-cookie")).toContain("rc_chat_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.verify).toHaveBeenCalledWith(
      "turnstile-token",
      "192.0.2.20",
      { expectedAction: "chat" },
    );

    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ai.example/v1/chat");
    const upstreamBody = String(init.body);
    const parsed = JSON.parse(upstreamBody);
    expect(parsed).toMatchObject({ messages: payload.messages, locale: "bn" });
    expect(parsed.conversation_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(parsed.conversation_id).not.toBe("browser-controlled");
    expect(parsed.client_id).toBeUndefined();
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledWith("192.0.2.20", parsed.conversation_id);
    const headers = new Headers(init.headers);
    const timestamp = headers.get("x-ai-timestamp")!;
    expect(headers.get("x-ai-signature")).toBe(
      createHmac("sha256", "service-secret")
        .update(`${timestamp}.${upstreamBody}`)
        .digest("hex"),
    );
  });

  it("adds only the signed-in user's server-resolved client ID to the signed body", async () => {
    const verifiedClientId = "22222222-2222-4222-8222-222222222222";
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-client-a" } }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { id: verifiedClientId }, error: null });

    const response = await POST(request(payload, { token: "turnstile-token" }));

    expect(response.status).toBe(200);
    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    const upstreamBody = String(init.body);
    const parsed = JSON.parse(upstreamBody);
    expect(parsed.client_id).toBe(verifiedClientId);
    expect(parsed.client_id).not.toBe(payload.client_id);
    expect(mocks.from).toHaveBeenCalledWith("clients");
    const clientQuery = mocks.from.mock.results[0].value;
    expect(clientQuery.select).toHaveBeenCalledWith("id");
    expect(clientQuery.eq).toHaveBeenCalledWith("user_id", "user-client-a");
    expect(new Headers(init.headers).get("x-ai-signature")).toBe(
      createHmac("sha256", "service-secret")
        .update(`${new Headers(init.headers).get("x-ai-timestamp")}.${upstreamBody}`)
        .digest("hex"),
    );
  });

  it("reuses the signed conversation cookie without another Turnstile challenge", async () => {
    const first = await POST(request(payload, { token: "turnstile-token" }));
    const cookie = first.cookies.get("rc_chat_session")!.value;
    mocks.fetch.mockResolvedValueOnce(new Response("event: message_end\ndata: {}\n\n", {
      headers: { "content-type": "text/event-stream" },
    }));

    const second = await POST(request(payload, { cookie }));
    expect(second.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(second.cookies.get("rc_chat_session")).toBeUndefined();
    const firstBody = JSON.parse(String(mocks.fetch.mock.calls[0][1].body));
    const secondBody = JSON.parse(String(mocks.fetch.mock.calls[1][1].body));
    expect(secondBody.conversation_id).toBe(firstBody.conversation_id);
  });

  it("requires Turnstile for a missing or tampered session cookie", async () => {
    let response = await POST(request(payload));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "turnstile_required" });

    const established = await POST(request(payload, { token: "turnstile-token" }));
    const token = established.cookies.get("rc_chat_session")!.value;
    response = await POST(request(payload, { cookie: `${token.slice(0, -1)}x` }));
    expect(response.status).toBe(403);
  });

  it("reports unavailable Turnstile infrastructure separately from a failed challenge", async () => {
    mocks.verify.mockResolvedValue({ success: false, errors: ["siteverify-unavailable"] });
    let response = await POST(request(payload, { token: "token" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "protection_unavailable" });

    mocks.verify.mockResolvedValue({ success: false, errors: ["invalid-input-response"] });
    response = await POST(request(payload, { token: "token" }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "turnstile_failed" });
  });

  it("rejects invalid input and rate-limited clients before calling the AI service", async () => {
    let response = await POST(request({ messages: [] }, { token: "token" }));
    expect(response.status).toBe(400);
    expect(mocks.limit).not.toHaveBeenCalled();

    mocks.limit.mockResolvedValue({
      allowed: false,
      ip: { allowed: true, limit: 60, remaining: 39, reset: 1060 },
      session: { allowed: false, limit: 20, remaining: 0, reset: 1060 },
    });
    response = await POST(request(payload, { token: "token" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(response.headers.get("x-ratelimit-session-remaining")).toBe("0");
    expect(response.headers.get("x-ratelimit-ip-remaining")).toBe("39");
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("aborts FastAPI when it does not start a response before the timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AI_CHAT_CONNECT_TIMEOUT_MS", "1000");
    mocks.fetch.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    const pending = POST(request(payload, { token: "turnstile-token" }));
    await vi.advanceTimersByTimeAsync(1000);
    const response = await pending;

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({ code: "service_timeout" });
  });

  it("aborts the upstream request when the browser disconnects", async () => {
    const controller = new AbortController();
    mocks.fetch.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    const pending = POST(request(payload, { token: "turnstile-token", signal: controller.signal }));
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    controller.abort();
    const response = await pending;

    expect(response.status).toBe(499);
    await expect(response.json()).resolves.toMatchObject({ code: "client_disconnected" });
  });
});
