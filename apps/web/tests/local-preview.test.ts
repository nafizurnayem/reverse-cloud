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
    expect(body.messages.at(-1).content).toContain("/services/website-development");
    expect(body.model).toBe("llama3.2:1b-instruct-q4_K_M");
    expect(body.keep_alive).toBe("24h");
    expect(body.options).toEqual({ num_ctx: 1_024, num_predict: 48 });
  });

  it("answers broad service questions from the catalog without model latency", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        locale: "en",
        messages: [{ role: "user", content: "What services does Reverse Cloud provide?" }],
      }),
    });
    const response = await localPreviewChat(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.reply).toContain("Website Development");
    expect(payload.reply).toContain("AI Chatbots & Agents");
    expect(payload.reply).toContain("/services");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns the live scheduler card for booking requests without model latency", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        locale: "en",
        messages: [{ role: "user", content: "Book a meeting at 10 am on 12th Nov" }],
      }),
    });
    const response = await localPreviewChat(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.reply).toContain("live available times");
    expect(payload.cards).toEqual([{
      type: "booking_scheduler",
      data: {
        requestedText: "Book a meeting at 10 am on 12th Nov",
        meetingTypeKey: "discovery_call",
      },
    }]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns the secure cancellation card instead of booking slots", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        locale: "en",
        messages: [{ role: "user", content: "I want to cancel my booking" }],
      }),
    });
    const response = await localPreviewChat(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reply: expect.stringContaining("Checking your account"),
      cards: [{ type: "booking_cancellation" }],
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("limits transcript history before sending it to the model", async () => {
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        locale: "en",
        messages: [
          { role: "user", content: "First question" },
          { role: "assistant", content: "First answer" },
          { role: "user", content: "Second question" },
          { role: "assistant", content: "Second answer" },
          { role: "user", content: "Third question" },
          { role: "assistant", content: "Third answer" },
          { role: "user", content: "Tell me more about that unusual requirement" },
        ],
      }),
    });
    const response = await localPreviewChat(request);
    expect(response.status).toBe(200);
    const body = JSON.parse(String(mocks.fetch.mock.calls[0][1].body));
    expect(body.messages).toHaveLength(5);
    expect(body.messages[1].content).toBe("Second answer");
    expect(body.messages.some((message: { content: string }) => message.content === "First question")).toBe(false);
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

  it("removes a model fragment left after the fast output cap", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      message: { content: "Use Next.js with PostgreSQL. Another unfinished recommendation that" },
    })));
    const request = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        locale: "en",
        messages: [{ role: "user", content: "Suggest an unusual technical approach" }],
      }),
    });
    const response = await localPreviewChat(request);
    expect(await response.json()).toEqual({ reply: "Use Next.js with PostgreSQL." });
  });
});
