import type {
  ChatCard,
  ChatStreamEvent,
  EstimateCardData,
  HumanHandoffCardData,
  LeadSavedCardData,
} from "./protocol";

export function parseSseMessage(rawBlock: string): ChatStreamEvent | null {
  const lines = rawBlock.split(/\r?\n/);
  let eventName: string | null = null;
  let dataRaw = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      const value = line.slice(5).trim();
      dataRaw = dataRaw ? `${dataRaw}\n${value}` : value;
    }
  }

  if (!eventName && !dataRaw) return null;

  let parsedData: unknown = {};
  if (dataRaw) {
    try {
      parsedData = JSON.parse(dataRaw);
    } catch {
      parsedData = { text: dataRaw };
    }
  }

  const payload = (typeof parsedData === "object" && parsedData !== null)
    ? parsedData as Record<string, unknown>
    : { text: String(parsedData) };

  switch (eventName) {
    case "message_start":
      return {
        event: "message_start",
        data: {
          conversation_id: typeof payload.conversation_id === "string" ? payload.conversation_id : undefined,
        },
      };

    case "text_delta":
      return {
        event: "text_delta",
        data: {
          text: typeof payload.text === "string" ? payload.text : "",
        },
      };

    case "message_end":
      return {
        event: "message_end",
        data: {
          reason: typeof payload.reason === "string" ? payload.reason : "stop",
        },
      };

    case "error":
      return {
        event: "error",
        data: {
          code: typeof payload.code === "string" ? payload.code : "stream_error",
          message: typeof payload.message === "string" ? payload.message : "An error occurred",
        },
      };

    case "card":
      if (payload.type && payload.data) {
        return {
          event: "card",
          data: payload as unknown as ChatCard,
        };
      }
      return null;

    case "card_estimate":
      return {
        event: "card",
        data: {
          type: "estimate",
          data: payload as unknown as EstimateCardData,
        },
      };

    case "card_lead_saved":
      return {
        event: "card",
        data: {
          type: "lead_saved",
          data: payload as unknown as LeadSavedCardData,
        },
      };

    case "card_human_handoff":
      return {
        event: "card",
        data: {
          type: "human_handoff",
          data: payload as unknown as HumanHandoffCardData,
        },
      };

    default:
      if (typeof payload.text === "string" && payload.text.length > 0) {
        return {
          event: "text_delta",
          data: { text: payload.text },
        };
      }
      return null;
  }
}

export async function* parseChatStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const event = parseSseMessage(trimmed);
        if (event) {
          yield event;
        }
      }
    }

    const trailing = buffer.trim();
    if (trailing) {
      const event = parseSseMessage(trailing);
      if (event) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
