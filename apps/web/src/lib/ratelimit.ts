import "server-only";

import { createHmac } from "node:crypto";

type RateLimitOptions = {
  fetcher?: typeof fetch;
  now?: number;
  redisUrl?: string;
  redisToken?: string;
  hashSecret?: string;
  production?: boolean;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export type ChatRateLimitResult = {
  allowed: boolean;
  ip: RateLimitResult;
  session: RateLimitResult;
};

const localWindows = new Map<string, { count: number; expiresAt: number }>();

export function requestIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return headers.get("cf-connecting-ip")?.trim()
    || headers.get("x-real-ip")?.trim()
    || forwarded
    || "unknown";
}

function hashedKey(identity: string, secret: string) {
  return createHmac("sha256", secret).update(identity).digest("hex");
}

function localLimit(key: string, limit: number, windowSeconds: number, now: number): RateLimitResult {
  const current = localWindows.get(key);
  const entry = !current || current.expiresAt <= now
    ? { count: 1, expiresAt: now + windowSeconds }
    : { count: current.count + 1, expiresAt: current.expiresAt };
  localWindows.set(key, entry);
  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    reset: entry.expiresAt,
  };
}

async function limitRequests(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const redisUrl = options.redisUrl ?? process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = options.redisToken ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  const hashSecret = options.hashSecret
    ?? process.env.RATE_LIMIT_SALT
    ?? process.env.CHAT_COOKIE_SECRET
    ?? process.env.TURNSTILE_SECRET_KEY;
  const production = options.production ?? process.env.NODE_ENV === "production";
  if (!hashSecret) throw new Error("RATE_LIMIT_SALT is not configured.");
  const key = `rate:${scope}:${hashedKey(identity, hashSecret)}`;

  if (!redisUrl || !redisToken) {
    if (production) throw new Error("Upstash rate limiting is not configured.");
    return localLimit(key, limit, windowSeconds, now);
  }

  const response = await (options.fetcher ?? fetch)(`${redisUrl.replace(/\/$/, "")}/multi-exec`, {
    method: "POST",
    headers: { authorization: `Bearer ${redisToken}`, "content-type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, windowSeconds, "NX"],
      ["TTL", key],
    ]),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Rate-limit service is unavailable.");
  const results = await response.json() as Array<{ result?: number; error?: string }>;
  const count = Number(results[0]?.result);
  const ttl = Number(results[2]?.result);
  if (!Number.isFinite(count) || results.some((item) => item.error)) {
    throw new Error("Rate-limit service returned an invalid response.");
  }
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: now + (ttl > 0 ? ttl : windowSeconds),
  };
}

export function limitContactRequests(ip: string, options: RateLimitOptions = {}) {
  return limitRequests("contact", ip, 5, 60 * 60, options);
}

export function limitPreviewChatRequests(ip: string) {
  // shortcut: one server process for the temporary preview; use Redis for a stable deployment.
  return limitRequests("preview-chat", ip, 5, 60, { production: false });
}

export function limitScheduleRequests(ip: string, options: RateLimitOptions = {}) {
  return limitRequests("schedule", ip, 30, 60, options);
}

export function limitScheduleBookingRequests(ip: string, options: RateLimitOptions = {}) {
  return limitRequests("schedule:booking", ip, 5, 60 * 60, options);
}

export async function limitChatRequests(
  ip: string,
  sessionId: string,
  options: RateLimitOptions = {},
): Promise<ChatRateLimitResult> {
  const [ipResult, sessionResult] = await Promise.all([
    limitRequests("chat:ip", ip, 60, 60, options),
    limitRequests("chat:session", sessionId, 20, 60, options),
  ]);
  return {
    allowed: ipResult.allowed && sessionResult.allowed,
    ip: ipResult,
    session: sessionResult,
  };
}
