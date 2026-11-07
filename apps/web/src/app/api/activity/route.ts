import { NextRequest, NextResponse } from "next/server";
import { validateActivityPayload } from "@/lib/activity/values";

export const runtime = "nodejs";

type RateBucket = {
  startedAt: number;
  requests: number;
  events: number;
};

const rateBuckets = new Map<string, RateBucket>();
const windowMs = 60_000;

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function configuredOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").origin;
  } catch {
    return null;
  }
}

function requestIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return headers.get("cf-connecting-ip")?.trim()
    || headers.get("x-real-ip")?.trim()
    || forwarded
    || "unknown";
}

function rateAllowed(key: string, eventCount: number) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  const bucket = !current || now - current.startedAt >= windowMs
    ? { startedAt: now, requests: 0, events: 0 }
    : current;

  bucket.requests += 1;
  bucket.events += eventCount;
  rateBuckets.set(key, bucket);

  if (rateBuckets.size > 10_000) {
    for (const [bucketKey, value] of rateBuckets) {
      if (now - value.startedAt >= windowMs) rateBuckets.delete(bucketKey);
    }
  }

  return bucket.requests <= 120 && bucket.events <= 600;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32_000) return response({ ok: false }, 413);

  const origin = request.headers.get("origin");
  const expectedOrigin = configuredOrigin();
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || !expectedOrigin || origin !== expectedOrigin || fetchSite === "cross-site") {
    return response({ ok: false }, 403);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return response({ ok: false }, 400);
  }

  const payload = validateActivityPayload(input);
  if (!payload) return response({ ok: false }, 400);

  const rateKey = requestIp(request.headers) ?? payload.sessionId;
  if (!rateAllowed(rateKey, payload.events.length)) {
    return response({ ok: false }, 429);
  }

  const receivedAt = new Date().toISOString();
  const cfRay = request.headers.get("cf-ray")?.slice(0, 80) || undefined;
  for (const event of payload.events) {
    console.info("[activity]", JSON.stringify({
      receivedAt,
      sessionId: payload.sessionId,
      cfRay,
      ...event,
    }));
  }

  return response({ ok: true }, 202);
}
