import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getApprovedReviews, REVIEWS_CATALOG } from "@/lib/reviews-catalog";

describe("Home Reviews & Testimonials Catalog", () => {
  it("provides curated verified testimonials", () => {
    expect(REVIEWS_CATALOG.length).toBeGreaterThanOrEqual(2);
    for (const review of REVIEWS_CATALOG) {
      expect(review.id).toBeTruthy();
      expect(review.reviewer_name).toBeTruthy();
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      expect(review.body.length).toBeGreaterThanOrEqual(10);
      expect(["en", "bn"]).toContain(review.locale);
      expect(review.is_featured).toBe(true);
    }
  });

  it("filters testimonials by English and Bengali locales", async () => {
    const enReviews = await getApprovedReviews("en");
    expect(enReviews.length).toBeGreaterThanOrEqual(1);
    expect(enReviews.every((r) => r.locale === "en")).toBe(true);

    const bnReviews = await getApprovedReviews("bn");
    expect(bnReviews.length).toBeGreaterThanOrEqual(1);
    expect(bnReviews.every((r) => r.locale === "bn")).toBe(true);
  });

  it("returns fallback reviews when database is unconfigured or empty", async () => {
    const allReviews = await getApprovedReviews();
    expect(allReviews.length).toBe(REVIEWS_CATALOG.length);
    expect(allReviews[0].reviewer_name).toBe(REVIEWS_CATALOG[0].reviewer_name);
  });
});
