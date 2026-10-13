import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAllServiceSlugs, SERVICES_CATALOG } from "../src/lib/services-catalog";
import { getServiceBySlug } from "../src/lib/services-server";


describe("Services Catalog", () => {
  const expectedSlugs = [
    "website-development",
    "ai-automation",
    "ai-chatbots-agents",
    "ui-ux-design",
    "software-development",
    "system-management",
    "system-architecture-design",
    "marketing",
    "crm-integration",
    "adsense-services",
    "saas-development",
  ];

  it("contains all 11 database-seeded service slugs", () => {
    const slugs = getAllServiceSlugs();
    expect(slugs).toHaveLength(11);
    expect(slugs).toEqual(expect.arrayContaining(expectedSlugs));
  });

  it("verifies every service conforms to database pricing models and bilingual requirements", () => {
    const validModels = ["fixed", "hourly", "retainer", "custom"];

    for (const service of SERVICES_CATALOG) {
      expect(expectedSlugs).toContain(service.slug);
      expect(validModels).toContain(service.pricing_model);
      expect(service.name_en.trim().length).toBeGreaterThan(0);
      expect(service.name_bn.trim().length).toBeGreaterThan(0);
      expect(service.summary_en.trim().length).toBeGreaterThan(0);
      expect(service.summary_bn.trim().length).toBeGreaterThan(0);
      expect(service.body_en.trim().length).toBeGreaterThan(0);
      expect(service.body_bn.trim().length).toBeGreaterThan(0);
      expect(service.deliverables_en.length).toBeGreaterThan(0);
      expect(service.deliverables_bn.length).toBe(service.deliverables_en.length);
      expect(service.process_en.length).toBeGreaterThan(0);
      expect(service.process_bn.length).toBe(service.process_en.length);
      expect(service.faqs_en.length).toBeGreaterThan(0);
      expect(service.faqs_bn.length).toBe(service.faqs_en.length);
      expect(service.tech_stack.length).toBeGreaterThan(0);
      if (service.starting_from_usd !== null) {
        expect(service.starting_from_usd).toBeGreaterThan(0);
      }
    }
  });

  it("retrieves a valid service detail item by slug with full fallback", async () => {
    const service = await getServiceBySlug("website-development");
    expect(service).not.toBeNull();
    expect(service?.slug).toBe("website-development");
    expect(service?.name_en).toBe("Website Development");
    expect(service?.name_bn).toBe("ওয়েবসাইট ডেভেলপমেন্ট");
    expect(service?.pricing_model).toBe("fixed");
  });

  it("returns null for non-existent service slug", async () => {
    const service = await getServiceBySlug("non-existent-service-slug");
    expect(service).toBeNull();
  });
});
