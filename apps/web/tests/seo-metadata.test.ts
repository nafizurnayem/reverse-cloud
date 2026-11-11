import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";

describe("Phase 5 Wave 1: SEO, Robots & Sitemap Verification", () => {
  it("generates correct robots.txt rules", () => {
    const config = robots();
    expect(config.rules).toBeDefined();

    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");

    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];
    expect(disallow).toContain("/admin/");
    expect(disallow).toContain("/portal/");
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/auth/");
    expect(disallow).toContain("/accept-invite");

    expect(config.sitemap).toContain("/sitemap.xml");
  });

  it("generates one clean public URL for each indexable page", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const urls = entries.map((e) => e.url);

    // Locale selection is cookie-based, so the public URL is unique and unprefixed.
    expect(urls).toContain("https://revcloud.dev/");
    expect(urls).toContain("https://revcloud.dev/services");
    expect(urls).toContain("https://revcloud.dev/schedule");
    expect(urls).toContain("https://revcloud.dev/pricing");
    expect(urls).toContain("https://revcloud.dev/about");
    expect(urls).toContain("https://revcloud.dev/contact");
    expect(urls).toContain("https://revcloud.dev/terms");
    expect(urls).toContain("https://revcloud.dev/privacy");
    expect(urls.some((url) => /\/(?:en|bn)(?:\/|$)/.test(url))).toBe(false);

    const rootEntry = entries.find((e) => e.url === "https://revcloud.dev/");
    expect(rootEntry).toBeDefined();
    expect(rootEntry?.alternates?.languages).toBeUndefined();

    // Verify priority weighting
    expect(rootEntry?.priority).toBe(1.0);
    const servicesEntry = entries.find((e) => e.url === "https://revcloud.dev/services");
    expect(servicesEntry?.priority).toBeGreaterThanOrEqual(0.8);
  });

  it("indexes dynamic service detail pages", async () => {
    const entries = await sitemap();
    const serviceUrls = entries.filter((e) => e.url.includes("/services/"));
    expect(serviceUrls.length).toBeGreaterThan(0);
    expect(serviceUrls.some((e) => e.url.includes("website-development"))).toBe(true);
  });
});
