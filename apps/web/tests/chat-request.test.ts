import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatRequestError, requestChatResponse } from "../src/lib/chat/request";

const payload = {
  messages: [{ role: "user" as const, content: "so add" }],
  locale: "en" as const,
};

function rejected(code: string, status = 403) {
  return Response.json({ code }, { status });
}

afterEach(() => vi.unstubAllGlobals());

describe("live chat requests", () => {
  it("continues an established session without requesting another security token", async () => {
    const response = new Response("event: message_end\ndata: {}\n\n");
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetch);
    const verify = vi.fn();

    expect(await requestChatResponse(payload, verify, new AbortController().signal)).toBe(response);
    expect(verify).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(["turnstile_required", "turnstile_failed"])(
    "completes %s verification and resends the original message with the token",
    async (code) => {
      const response = new Response("event: text_delta\ndata: {\"text\":\"Hello\"}\n\n");
      const fetch = vi.fn()
        .mockResolvedValueOnce(rejected(code))
        .mockResolvedValueOnce(response);
      vi.stubGlobal("fetch", fetch);
      const verify = vi.fn().mockResolvedValue("fresh-chat-token");
      const signal = new AbortController().signal;

      expect(await requestChatResponse(payload, verify, signal)).toBe(response);
      expect(verify).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify(payload));
      expect(fetch.mock.calls[1]).toEqual(["/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-turnstile-token": "fresh-chat-token" },
        body: JSON.stringify(payload),
        signal,
      }]);
    },
  );

  it("stops after one rejected verification attempt", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(rejected("turnstile_failed")));
    vi.stubGlobal("fetch", fetch);
    const verify = vi.fn().mockResolvedValue("invalid-token");

    await expect(requestChatResponse(payload, verify, new AbortController().signal))
      .rejects.toMatchObject({ code: "turnstile_failed", status: 403 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenCalledOnce();
  });

  it("keeps verification failures separate from service failures", async () => {
    const fetch = vi.fn().mockResolvedValue(rejected("turnstile_required"));
    vi.stubGlobal("fetch", fetch);
    const failure = new ChatRequestError("turnstile_failed", 403);
    const verify = vi.fn().mockRejectedValue(failure);

    await expect(requestChatResponse(payload, verify, new AbortController().signal)).rejects.toBe(failure);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not replay a message after the user resets the chat during verification", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(rejected("turnstile_required"));
    vi.stubGlobal("fetch", fetch);
    const verify = vi.fn().mockImplementation(async () => {
      controller.abort();
      return "late-token";
    });

    await expect(requestChatResponse(payload, verify, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    [429, "rate_limited"],
    [503, "protection_unavailable"],
    [502, "service_unavailable"],
  ])("preserves the %s error for appropriate recovery", async (status, code) => {
    const fetch = vi.fn().mockResolvedValue(rejected(code, status));
    vi.stubGlobal("fetch", fetch);
    const verify = vi.fn();

    await expect(requestChatResponse(payload, verify, new AbortController().signal))
      .rejects.toMatchObject({ status, code });
    expect(verify).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("handles non-JSON errors from a proxy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad gateway", { status: 502 })));

    await expect(requestChatResponse(payload, vi.fn(), new AbortController().signal))
      .rejects.toMatchObject({ status: 502, code: "request_failed" });
  });
});
