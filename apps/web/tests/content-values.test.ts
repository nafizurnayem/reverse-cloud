import { describe, expect, it } from "vitest";
import { contentErrorKey, normalizeSlug, parseJson, stringList } from "../src/lib/admin/content-values";

describe("content form values", () => {
  it("normalizes editor labels into valid database slugs", () => {
    expect(normalizeSlug("  AI Chatbots & Agents  ")).toBe("ai-chatbots-agents");
    expect(normalizeSlug("বাংলা সেবা")).toBe("");
  });

  it("parses comma and newline separated lists", () => {
    const form = new FormData();
    form.set("values", "Next.js, Supabase\nFastAPI, Next.js");
    expect(stringList(form, "values")).toEqual(["Next.js", "Supabase", "FastAPI", "Next.js"]);
  });

  it("parses JSON values without converting their types", () => {
    expect(parseJson('{"enabled":true,"limit":10}')).toEqual({ enabled: true, limit: 10 });
    expect(parseJson('"hello"')).toBe("hello");
  });

  it("maps publication constraints to friendly error keys", () => {
    expect(contentErrorKey({ code: "23505" })).toBe("duplicateSlug");
    expect(contentErrorKey({ code: "23514", message: "portfolio_publish_needs_consent" })).toBe("portfolioNeedsConsent");
    expect(contentErrorKey({ code: "23514", message: "blog_publish_needs_english" })).toBe("publishNeedsEnglish");
    expect(contentErrorKey({ code: "42501" })).toBe("saveFailed");
  });
});
