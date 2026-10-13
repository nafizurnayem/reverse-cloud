import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getAllPortfolioSlugs,
  getPortfolioItemBySlug,
  getPortfolioItems,
  PORTFOLIO_CATALOG,
} from "../src/lib/portfolio-catalog";

describe("Portfolio Catalog", () => {
  it("verifies all portfolio items have required client consent before publication", () => {
    for (const item of PORTFOLIO_CATALOG) {
      // In accordance with database constraint portfolio_publish_needs_consent
      if (item.is_published) {
        expect(item.client_consent).toBe(true);
      }
      expect(item.title_en.trim().length).toBeGreaterThan(0);
      expect(item.title_bn.trim().length).toBeGreaterThan(0);
      expect(item.summary_en.trim().length).toBeGreaterThan(0);
      expect(item.summary_bn.trim().length).toBeGreaterThan(0);
      expect(item.challenge_en.trim().length).toBeGreaterThan(0);
      expect(item.challenge_bn.trim().length).toBeGreaterThan(0);
      expect(item.solution_en.trim().length).toBeGreaterThan(0);
      expect(item.solution_bn.trim().length).toBeGreaterThan(0);
      expect(item.result_en.trim().length).toBeGreaterThan(0);
      expect(item.result_bn.trim().length).toBeGreaterThan(0);
      expect(item.tech_stack.length).toBeGreaterThan(0);
    }
  });

  it("retrieves all published portfolio items", async () => {
    const items = await getPortfolioItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.is_published && i.client_consent)).toBe(true);
  });

  it("retrieves a specific portfolio case study by slug", async () => {
    const item = await getPortfolioItemBySlug("cloud-logistics-ai");
    expect(item).not.toBeNull();
    expect(item?.slug).toBe("cloud-logistics-ai");
    expect(item?.public_client_name).toBe("TransGlobal Freight Solutions");
    expect(item?.category).toBe("ai");
  });

  it("returns null for non-existent portfolio slug", async () => {
    const item = await getPortfolioItemBySlug("unknown-non-existent-case-study");
    expect(item).toBeNull();
  });

  it("lists all static slugs for SSG generation", () => {
    const slugs = getAllPortfolioSlugs();
    expect(slugs).toContain("cloud-logistics-ai");
    expect(slugs).toContain("fintech-payment-portal");
    expect(slugs).toContain("bilingual-ecommerce-platform");
  });
});
