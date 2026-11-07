export const activityEventTypes = [
  "page_view",
  "navigation",
  "click",
  "form_submit",
  "field_change",
  "api_request",
  "api_response",
  "api_error",
  "client_error",
  "promise_rejection",
] as const;

export type ActivityEventType = (typeof activityEventTypes)[number];

export type ActivityEvent = {
  type: ActivityEventType;
  page: string;
  clientTimestamp: number;
  details: Record<string, string | number | boolean>;
};

export type ActivityPayload = {
  sessionId: string;
  events: ActivityEvent[];
};

const eventTypes = new Set<string>(activityEventTypes);
const detailKeys = new Set([
  "target",
  "field",
  "method",
  "status",
  "ok",
  "durationMs",
  "navigationType",
  "errorName",
]);
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDetails(value: unknown) {
  const input = object(value) ?? {};
  const details: Record<string, string | number | boolean> = {};

  for (const [key, raw] of Object.entries(input)) {
    if (!detailKeys.has(key)) continue;
    if (typeof raw === "string") {
      const cleaned = text(raw, 160);
      if (cleaned) details[key] = cleaned;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      details[key] = Math.round(raw);
    } else if (typeof raw === "boolean") {
      details[key] = raw;
    }
  }

  return details;
}

export function validateActivityPayload(value: unknown): ActivityPayload | null {
  const input = object(value);
  if (!input) return null;

  const sessionId = text(input.sessionId, 36);
  if (!sessionPattern.test(sessionId) || !Array.isArray(input.events) || input.events.length < 1 || input.events.length > 25) {
    return null;
  }

  const events: ActivityEvent[] = [];
  for (const rawEvent of input.events) {
    const event = object(rawEvent);
    if (!event) return null;

    const type = text(event.type, 32);
    const page = text(event.page, 200);
    const clientTimestamp = event.clientTimestamp;
    if (
      !eventTypes.has(type)
      || !page.startsWith("/")
      || typeof clientTimestamp !== "number"
      || !Number.isFinite(clientTimestamp)
      || clientTimestamp <= 0
    ) {
      return null;
    }

    events.push({
      type: type as ActivityEventType,
      page,
      clientTimestamp: Math.round(clientTimestamp),
      details: cleanDetails(event.details),
    });
  }

  return { sessionId, events };
}
