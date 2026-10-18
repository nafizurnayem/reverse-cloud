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

  it("generates dynamic sitemap for both English and Bangla locales", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const urls = entries.map((e) => e.url);

    // Verify static routes in both languages
    expect(urls.some((u) => u.endsWith("/en"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/bn"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/services"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/bn/services"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/schedule"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/bn/schedule"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/pricing"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/bn/pricing"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/about"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/bn/about"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/contact"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/bn/contact"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/terms"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/bn/privacy"))).toBe(true);

    // Verify alternate language tags exist
    const rootEntry = entries.find((e) => e.url.endsWith("/en"));
    expect(rootEntry).toBeDefined();
    expect(rootEntry?.alternates?.languages).toBeDefined();
    expect(rootEntry?.alternates?.languages?.en).toContain("/en");
    expect(rootEntry?.alternates?.languages?.bn).toContain("/bn");

    // Verify priority weighting
    expect(rootEntry?.priority).toBe(1.0);
    const servicesEntry = entries.find((e) => e.url.endsWith("/en/services"));
    expect(servicesEntry?.priority).toBeGreaterThanOrEqual(0.8);
  });

  it("indexes dynamic service detail pages", async () => {
    const entries = await sitemap();
    const serviceUrls = entries.filter((e) => e.url.includes("/services/"));
    expect(serviceUrls.length).toBeGreaterThan(0);
    expect(serviceUrls.some((e) => e.url.includes("website-development"))).toBe(true);
  });
});
