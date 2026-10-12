import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { limitContactRequests, requestIp } from "../src/lib/ratelimit";
import { verifyTurnstile } from "../src/lib/turnstile";

describe("public form protection", () => {
  it("uses the trusted proxy address precedence", () => {
    expect(requestIp(new Headers({
      "cf-connecting-ip": "203.0.113.1",
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    }))).toBe("203.0.113.1");
    expect(requestIp(new Headers({ "x-forwarded-for": "198.51.100.1, 198.51.100.2" }))).toBe("198.51.100.1");
  });

  it("limits local development submissions to five per hour", async () => {
    const options = { hashSecret: "test-secret", production: false, now: 1000 };
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await limitContactRequests("192.0.2.15", options)).allowed).toBe(true);
    }
    const blocked = await limitContactRequests("192.0.2.15", options);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0, reset: 4600 });
  });

  it("accepts only a successful Turnstile contact action", async () => {
    const accepted = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      action: "contact",
      hostname: "example.com",
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(verifyTurnstile("valid", "192.0.2.1", {
      secret: "secret",
      expectedHostname: "example.com",
      fetcher: accepted,
    })).resolves.toMatchObject({ success: true });

    const wrongAction = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      action: "login",
      hostname: "example.com",
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(verifyTurnstile("valid", "192.0.2.1", {
      secret: "secret",
      expectedHostname: "example.com",
      fetcher: wrongAction,
    })).resolves.toMatchObject({ success: false });
  });

  it("allows action-less Cloudflare test tokens only outside production", async () => {
    const testToken = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      hostname: "example.com",
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(verifyTurnstile("test", null, {
      secret: "secret",
      fetcher: testToken,
      production: false,
    })).resolves.toMatchObject({ success: true });
    await expect(verifyTurnstile("test", null, {
      secret: "secret",
      fetcher: testToken,
      production: true,
    })).resolves.toMatchObject({ success: false });
  });
});
