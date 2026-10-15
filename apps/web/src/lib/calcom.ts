import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const CALCOM_API_VERSION = "2024-09-04";
export const MAX_SCHEDULE_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
export const MAX_WEBHOOK_BYTES = 256 * 1024;

export type ScheduleQuery = { meetingType: string; start: string; end: string; timeZone: string };
export type AvailableSlot = { start: string; end: string };
type CalSlot = { time?: unknown; start?: unknown; end?: unknown };

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function parseScheduleQuery(params: URLSearchParams, now = Date.now()):
  { ok: true; value: ScheduleQuery } | { ok: false; code: string } {
  const meetingType = (params.get("meetingType") ?? "").trim();
  const startValue = (params.get("start") ?? "").trim();
  const endValue = (params.get("end") ?? "").trim();
  const timeZone = (params.get("timeZone") ?? "UTC").trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,49}$/.test(meetingType)) return { ok: false, code: "invalid_meeting_type" };
  const start = Date.parse(startValue);
  const end = Date.parse(endValue);
  if (!Number.isFinite(start) || !Number.isFinite(end)
    || end <= start || end - start > MAX_SCHEDULE_RANGE_MS || start < now - 5 * 60 * 1000) {
    return { ok: false, code: "invalid_time_range" };
  }
  if (!isValidTimeZone(timeZone)) return { ok: false, code: "invalid_time_zone" };
  return { ok: true, value: { meetingType, start: new Date(start).toISOString(), end: new Date(end).toISOString(), timeZone } };
}

function slotRecords(input: unknown): CalSlot[] {
  if (Array.isArray(input)) return input.filter((item): item is CalSlot => Boolean(item && typeof item === "object"));
  if (!input || typeof input !== "object") return [];
  return Object.values(input).flatMap((value) => slotRecords(value));
}

export function normalizeSlots(input: unknown, durationMinutes: number): AvailableSlot[] {
  const root = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  const seen = new Set<string>();
  return slotRecords(data.slots ?? data).flatMap((slot) => {
    const startValue = typeof slot.start === "string" ? slot.start : slot.time;
    if (typeof startValue !== "string") return [];
    const startMs = Date.parse(startValue);
    const explicitEnd = typeof slot.end === "string" ? Date.parse(slot.end) : Number.NaN;
    if (!Number.isFinite(startMs)) return [];
    const endMs = Number.isFinite(explicitEnd) ? explicitEnd : startMs + durationMinutes * 60 * 1000;
    if (endMs <= startMs) return [];
    const start = new Date(startMs).toISOString();
    if (seen.has(start)) return [];
    seen.add(start);
    return [{ start, end: new Date(endMs).toISOString() }];
  }).sort((left, right) => left.start.localeCompare(right.start));
}

export async function fetchAvailableSlots(options: {
  apiKey: string; eventTypeId: string; start: string; end: string; timeZone: string;
  durationMinutes: number; signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number;
}) {
  if (!/^\d+$/.test(options.eventTypeId)) throw new Error("invalid_event_type_id");
  const baseUrl = (process.env.CALCOM_API_BASE_URL ?? "https://api.cal.com/v2").replace(/\/$/, "");
  const url = new URL(`${baseUrl}/slots`);
  url.searchParams.set("eventTypeId", options.eventTypeId);
  url.searchParams.set("start", options.start);
  url.searchParams.set("end", options.end);
  url.searchParams.set("timeZone", options.timeZone);
  url.searchParams.set("format", "range");
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, options.timeoutMs ?? 8_000);
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      headers: { authorization: `Bearer ${options.apiKey}`, "cal-api-version": process.env.CALCOM_API_VERSION ?? CALCOM_API_VERSION },
      cache: "no-store", signal: controller.signal,
    });
    if (!response.ok) throw new Error(`calcom_${response.status}`);
    return normalizeSlots(await response.json(), options.durationMinutes);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function verifyCalcomSignature(rawBody: string, header: string | null, secrets: string[]) {
  const supplied = (header ?? "").trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
  return secrets.some((secret) => safeEqual(supplied, createHmac("sha256", secret).update(rawBody).digest("hex")));
}

export function webhookSecrets() {
  return [process.env.CALCOM_WEBHOOK_SECRET_CURRENT, process.env.CALCOM_WEBHOOK_SECRET, process.env.CALCOM_WEBHOOK_SECRET_PREVIOUS]
    .map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

export function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function readLimitedBody(request: Request, maxBytes = MAX_WEBHOOK_BYTES) {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new Error("payload_too_large");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error("payload_too_large"); }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionalString(value: unknown, max = 320) {
  return typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null;
}

function optionalDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

export type CalcomWebhook = {
  triggerEvent: string; createdAt: string; bookingUid: string | null;
  meetingTypeKey: string | null; eventTypeId: string | null; proposalId: string | null;
  attendeeName: string | null; attendeeEmail: string | null; attendeeTimeZone: string | null;
  startsAt: string | null; endsAt: string | null;
};

export function parseCalcomWebhook(input: unknown): CalcomWebhook | null {
  const body = record(input);
  const payload = record(body.payload);
  const booking = Object.keys(payload).length ? payload : body;
  const metadata = record(booking.metadata);
  const eventType = record(booking.eventType);
  const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
  const attendee = record(attendees[0]);
  const responses = record(booking.responses);
  const emailResponse = record(responses.email);
  const triggerEvent = optionalString(body.triggerEvent, 80) ?? "";
  const createdAt = optionalDate(body.createdAt);
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(triggerEvent) || !createdAt) return null;
  const uid = booking.uid ?? record(booking.booking).uid ?? body.uid;
  const proposal = metadata.bookingProposalId ?? metadata.proposalId ?? metadata.booking_proposal_id;
  const eventIdValue = booking.eventTypeId ?? eventType.id;
  return {
    triggerEvent, createdAt,
    bookingUid: optionalString(uid, 200),
    meetingTypeKey: optionalString(booking.type ?? eventType.slug, 50),
    eventTypeId: typeof eventIdValue === "number" || typeof eventIdValue === "string" ? String(eventIdValue) : null,
    proposalId: typeof proposal === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proposal) ? proposal : null,
    attendeeName: optionalString(booking.attendeeName ?? attendee.name, 200),
    attendeeEmail: optionalString(booking.attendeeEmail ?? booking.attendee_email ?? booking.email ?? emailResponse.value ?? attendee.email, 320)?.toLowerCase() ?? null,
    attendeeTimeZone: optionalString(booking.attendeeTimezone ?? attendee.timeZone, 100),
    startsAt: optionalDate(booking.startTime),
    endsAt: optionalDate(booking.endTime),
  };
}
