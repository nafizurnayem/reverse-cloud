import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const chatSessionCookie = "rc_chat_session";
export const chatSessionMaxAge = 24 * 60 * 60;

type SessionOptions = {
  now?: number;
  secret?: string;
};

export type ChatSession = {
  id: string;
  expiresAt: number;
  token: string;
  fresh: boolean;
};

function requireSecret(value = process.env.CHAT_COOKIE_SECRET) {
  if (!value || Buffer.byteLength(value) < 32) {
    throw new Error("CHAT_COOKIE_SECRET must contain at least 32 bytes.");
  }
  return value;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function createSession(now: number, secret: string): ChatSession {
  const id = randomUUID();
  const expiresAt = now + chatSessionMaxAge;
  const payload = `${id}.${expiresAt}`;
  return {
    id,
    expiresAt,
    token: `${payload}.${signature(payload, secret)}`,
    fresh: true,
  };
}

export function chatSession(cookieValue?: string, options: SessionOptions = {}): ChatSession {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const secret = requireSecret(options.secret);
  if (cookieValue) {
    const [id, expires, provided, ...extra] = cookieValue.split(".");
    const expiresAt = Number(expires);
    const payload = `${id}.${expires}`;
    if (
      extra.length === 0
      && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      && Number.isSafeInteger(expiresAt)
      && expiresAt > now
      && expiresAt <= now + chatSessionMaxAge
      && typeof provided === "string"
      && signaturesMatch(provided, signature(payload, secret))
    ) {
      return { id, expiresAt, token: cookieValue, fresh: false };
    }
  }
  return createSession(now, secret);
}
