/**
 * Lets any part of the site open the chat widget, optionally with a message.
 * The widget listens for this event; callers don't need a reference to it.
 */
export const OPEN_CHAT_EVENT = "rc:open-chat";
export const MAX_LAUNCH_PROMPT_LENGTH = 500;

export interface OpenChatRequest {
  /** Message to place in the chat. */
  prompt?: string;
  /** Send it immediately (only for clicks on site buttons). Otherwise it is only prefilled. */
  autoSend?: boolean;
}

/** Clean a launch prompt; returns undefined when there is nothing usable. */
export function cleanLaunchPrompt(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, MAX_LAUNCH_PROMPT_LENGTH);
  return cleaned || undefined;
}

export function readOpenChatRequest(event: Event): OpenChatRequest {
  const detail = (event as CustomEvent<unknown>).detail;
  if (!detail || typeof detail !== "object") return {};
  const { prompt, autoSend } = detail as Record<string, unknown>;
  const cleaned = cleanLaunchPrompt(prompt);
  return cleaned ? { prompt: cleaned, autoSend: autoSend === true } : {};
}

export function openChat(request: OpenChatRequest = {}) {
  window.dispatchEvent(new CustomEvent<OpenChatRequest>(OPEN_CHAT_EVENT, { detail: request }));
}
