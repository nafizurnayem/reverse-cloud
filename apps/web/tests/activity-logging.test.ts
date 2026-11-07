import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { validateActivityPayload } from "../src/lib/activity/values";
import { POST } from "../src/app/api/activity/route";

const sessionId = "00000000-0000-4000-8000-000000000042";
const event = {
  type: "click",
  page: "/en/contact",
  clientTimestamp: 1_794_070_000_000,
  details: {
    target: "button|type:submit",
    value: "private@example.com",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("activity logging", () => {
  it("accepts safe event metadata and drops field values", () => {
    expect(validateActivityPayload({ sessionId, events: [event] })).toEqual({
      sessionId,
      events: [{
        type: "click",
        page: "/en/contact",
        clientTimestamp: 1_794_070_000_000,
        details: { target: "button|type:submit" },
      }],
    });
  });

  it("rejects unknown events and oversized batches", () => {
    expect(validateActivityPayload({ sessionId, events: [{ ...event, type: "password_typed" }] })).toBeNull();
    expect(validateActivityPayload({ sessionId, events: Array.from({ length: 26 }, () => event) })).toBeNull();
  });

  it("writes one structured line without private field values", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example.com");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const request = new NextRequest("https://preview.example.com/api/activity", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://preview.example.com",
        "cf-connecting-ip": "192.0.2.10",
      },
      body: JSON.stringify({ sessionId, events: [event] }),
    });

    const result = await POST(request);

    expect(result.status).toBe(202);
    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls.flat().join(" ");
    expect(line).toContain("[activity]");
    expect(line).toContain('"type":"click"');
    expect(line).not.toContain("private@example.com");
  });

  it("rejects requests from a different website", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example.com");
    const request = new NextRequest("https://preview.example.com/api/activity", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
      },
      body: JSON.stringify({ sessionId, events: [event] }),
    });

    expect((await POST(request)).status).toBe(403);
  });
});
