export type ChatRequestBody = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  locale: "en" | "bn";
};

export type ChatValidation =
  | { ok: true; data: ChatRequestBody }
  | { ok: false; code: "invalid_input" };

export function validateChatPayload(value: unknown): ChatValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_input" };
  }
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 50) {
    return { ok: false, code: "invalid_input" };
  }

  const messages: ChatRequestBody["messages"] = [];
  for (const message of input.messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return { ok: false, code: "invalid_input" };
    }
    const candidate = message as Record<string, unknown>;
    if (
      (candidate.role !== "user" && candidate.role !== "assistant")
      || typeof candidate.content !== "string"
      || candidate.content.length < 1
      || candidate.content.length > 12_000
    ) {
      return { ok: false, code: "invalid_input" };
    }
    messages.push({ role: candidate.role, content: candidate.content });
  }

  const locale = input.locale === undefined ? "en" : input.locale;
  if (locale !== "en" && locale !== "bn") return { ok: false, code: "invalid_input" };
  return { ok: true, data: { messages, locale } };
}
