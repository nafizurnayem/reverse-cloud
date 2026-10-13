import { describe, expect, it } from "vitest";
import {
  createMockChatReadableStream,
  createMockChatResponse,
  getMockEvents,
  sampleEstimate,
  sampleHumanHandoff,
  sampleLeadSaved,
} from "../src/lib/chat/mock-stream";
import { parseChatStream, parseSseMessage } from "../src/lib/chat/stream-parser";

describe("Chat Stream Protocol & Parser", () => {
  it("parses single SSE blocks correctly", () => {
    const start = parseSseMessage('event: message_start\ndata: {"conversation_id":"c-123"}');
    expect(start).toEqual({
      event: "message_start",
      data: { conversation_id: "c-123" },
    });

    const delta = parseSseMessage('event: text_delta\ndata: {"text":"Hello world"}');
    expect(delta).toEqual({
      event: "text_delta",
      data: { text: "Hello world" },
    });

    const end = parseSseMessage('event: message_end\ndata: {"reason":"stop"}');
    expect(end).toEqual({
      event: "message_end",
      data: { reason: "stop" },
    });

    const err = parseSseMessage('event: error\ndata: {"code":"provider_error","message":"Downstream failure"}');
    expect(err).toEqual({
      event: "error",
      data: { code: "provider_error", message: "Downstream failure" },
    });
  });

  it("parses card events correctly", () => {
    const estimateEvent = parseSseMessage(
      `event: card\ndata: ${JSON.stringify({ type: "estimate", data: sampleEstimate })}`,
    );
    expect(estimateEvent).toEqual({
      event: "card",
      data: { type: "estimate", data: sampleEstimate },
    });

    const leadEvent = parseSseMessage(
      `event: card\ndata: ${JSON.stringify({ type: "lead_saved", data: sampleLeadSaved })}`,
    );
    expect(leadEvent).toEqual({
      event: "card",
      data: { type: "lead_saved", data: sampleLeadSaved },
    });

    const handoffEvent = parseSseMessage(
      `event: card\ndata: ${JSON.stringify({ type: "human_handoff", data: sampleHumanHandoff })}`,
    );
    expect(handoffEvent).toEqual({
      event: "card",
      data: { type: "human_handoff", data: sampleHumanHandoff },
    });
  });

  it("handles streams split across arbitrary chunk boundaries", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      "event: message_start\nda",
      'ta: {"conversation_id":"abc"}\n\n',
      "event: text_de",
      'lta\ndata: {"text":"Hi "}\n\n',
      'event: text_delta\ndata: {"text":"there"}\n\n',
      'event: message_end\ndata: {"reason":"stop"}\n\n',
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const events = [];
    for await (const event of parseChatStream(stream)) {
      events.push(event);
    }

    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ event: "message_start", data: { conversation_id: "abc" } });
    expect(events[1]).toEqual({ event: "text_delta", data: { text: "Hi " } });
    expect(events[2]).toEqual({ event: "text_delta", data: { text: "there" } });
    expect(events[3]).toEqual({ event: "message_end", data: { reason: "stop" } });
  });

  it("generates mock stream events for all scenarios", () => {
    const greeting = getMockEvents("greeting", "en", "c-1");
    expect(greeting.some((e) => e.event === "text_delta")).toBe(true);
    expect(greeting.at(-1)).toEqual({ event: "message_end", data: { reason: "stop" } });

    const estimate = getMockEvents("estimate", "en", "c-2");
    const estimateCard = estimate.find((e) => e.event === "card");
    expect(estimateCard?.data).toHaveProperty("type", "estimate");

    const lead = getMockEvents("lead_saved", "en", "c-3");
    const leadCard = lead.find((e) => e.event === "card");
    expect(leadCard?.data).toHaveProperty("type", "lead_saved");

    const handoff = getMockEvents("human_handoff", "en", "c-4");
    const handoffCard = handoff.find((e) => e.event === "card");
    expect(handoffCard?.data).toHaveProperty("type", "human_handoff");

    const error = getMockEvents("kill_switch_error", "en", "c-5");
    expect(error.some((e) => e.event === "error")).toBe(true);
  });

  it("streams mock stream chunks through parseChatStream end-to-end", async () => {
    const readable = createMockChatReadableStream("estimate", { delayMs: 0 });
    const events = [];
    for await (const event of parseChatStream(readable)) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(3);
    const cardEvent = events.find((e) => e.event === "card");
    expect(cardEvent).toBeDefined();
    expect(cardEvent?.data).toHaveProperty("type", "estimate");
  });

  it("handles kill_switch_error mock response", async () => {
    const response = createMockChatResponse("kill_switch_error", { delayMs: -1 });
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.code).toBe("not_configured");
  });
});
