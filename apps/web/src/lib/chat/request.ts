import type { ChatRequestBody } from "./values";

export class ChatRequestError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "ChatRequestError";
  }
}

export async function requestChatResponse(
  payload: ChatRequestBody,
  verify: () => Promise<string>,
  signal: AbortSignal,
) {
  const body = JSON.stringify(payload);
  const post = (token?: string) => fetch("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-turnstile-token": token } : {}),
    },
    body,
    signal,
  });

  let response = await post();
  if (response.status === 403) {
    const error = await response.clone().json().catch(() => null);
    if (error?.code === "turnstile_required" || error?.code === "turnstile_failed") {
      const token = await verify();
      signal.throwIfAborted();
      response = await post(token);
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ChatRequestError(error?.code ?? "request_failed", response.status);
  }
  return response;
}
