import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ limit: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ratelimit", () => ({
  requestIp: () => "192.0.2.1",
  limitPreviewChatRequests: mocks.limit,
}));

import { localPreviewChat } from "../src/lib/chat/local-preview";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ message: { content: "Starts at USD 1200." } })));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("local Ollama preview", () => {
  it("answers greetings directly without asking the model", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        locale: "en",
        messages: [{ role: "user", content: "Hi!" }],
      }),
    });
    const response = await localPreviewChat(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reply: expect.stringContaining("Welcome to Reverse Cloud"),
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("adds retrieved public facts to the model prompt", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        locale: "en",
        messages: [{ role: "user", content: "What is the starting price for Website Development?" }],
      }),
    });
    const response = await localPreviewChat(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "Starts at USD 1200." });
    const body = JSON.parse(String(mocks.fetch.mock.calls[0][1].body));
    expect(body.messages.at(-1).content).toContain("Starting price: USD 1200");
    expect(body.messages.at(-1).content).toContain("/en/services/website-development");
  });

  it("replaces an unhelpful model answer with a useful next step", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: "I don't know." } })));
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        locale: "en",
        messages: [{ role: "user", content: "Can you verify this unusual requirement?" }],
      }),
    });
    const response = await localPreviewChat(request);
    const payload = await response.json();
    expect(payload.reply).toContain("couldn’t verify");
    expect(payload.reply).toContain("connect you with the team");
  });
});
