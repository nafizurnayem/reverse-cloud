import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

import { validateReviewInput } from "@/lib/portal/portal-review-values";
import { submitProjectReview } from "@/lib/portal/portal-review-action";
import type { PortalReview } from "@/lib/portal/types";

describe("Portal Review Submission & Validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects input with missing project ID", () => {
    const result = validateReviewInput({
      projectId: "",
      rating: 5,
      reviewerName: "John Doe",
      body: "Outstanding delivery on time.",
      locale: "en",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_project");
  });

  it("rejects invalid rating values", () => {
    const invalidRatings = [0, 6, -1, 3.5, NaN];
    for (const rating of invalidRatings) {
      const result = validateReviewInput({
        projectId: "proj-123",
        rating,
        reviewerName: "John Doe",
        body: "Great work delivered.",
        locale: "en",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_rating");
    }
  });

  it("accepts valid ratings 1 through 5", () => {
    for (let r = 1; r <= 5; r++) {
      const result = validateReviewInput({
        projectId: "proj-123",
        rating: r,
        reviewerName: "John Doe",
        body: "Solid infrastructure deployment.",
        locale: "en",
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.rating).toBe(r);
    }
  });

  it("rejects empty reviewer name or overly long name", () => {
    const emptyResult = validateReviewInput({
      projectId: "proj-123",
      rating: 5,
      reviewerName: "   ",
      body: "Great communication throughout.",
      locale: "en",
    });
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.error).toBe("invalid_name");

    const longResult = validateReviewInput({
      projectId: "proj-123",
      rating: 5,
      reviewerName: "a".repeat(201),
      body: "Great communication throughout.",
      locale: "en",
    });
    expect(longResult.valid).toBe(false);
    expect(longResult.error).toBe("invalid_name");
  });

  it("rejects body that is too short (< 5 chars)", () => {
    const result = validateReviewInput({
      projectId: "proj-123",
      rating: 5,
      reviewerName: "John Doe",
      body: "Good",
      locale: "en",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_body");
  });

  it("sanitizes valid inputs and preserves Bengali locale", () => {
    const result = validateReviewInput({
      projectId: "  proj-fintech-01  ",
      rating: 5,
      reviewerName: "  রহিম চৌধুরী  ",
      reviewerTitle: "  হেড অব আইটি  ",
      body: "  খুব চমৎকার ক্লাউড মাইগ্রেশন এবং দুর্দান্ত টিমওয়ার্ক।  ",
      locale: "bn",
    });
    expect(result.valid).toBe(true);
    expect(result.sanitized).toEqual({
      projectId: "proj-fintech-01",
      rating: 5,
      reviewerName: "রহিম চৌধুরী",
      reviewerTitle: "হেড অব আইটি",
      body: "খুব চমৎকার ক্লাউড মাইগ্রেশন এবং দুর্দান্ত টিমওয়ার্ক।",
      locale: "bn",
    });
  });

  it("models portal reviews with pending status and project bindings", () => {
    const review: PortalReview = {
      id: "rev-001",
      projectId: "proj-saas-02",
      clientId: "client-001",
      reviewerName: "Nusrat Jahan",
      reviewerTitle: "Managing Director, Apex Logistics Tech",
      rating: 5,
      body: "Reverse Cloud automated our logistics dispatch platform flawlessly with Next.js 16 and Supabase RLS.",
      locale: "en",
      status: "pending",
      createdAt: "2026-10-17T12:00:00Z",
    };

    expect(review.status).toBe("pending");
    expect(review.rating).toBe(5);
    expect(review.projectId).toBe("proj-saas-02");
  });

  it("fails submission when user is not authenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Unauthorized") });

    const formData = new FormData();
    formData.append("projectId", "proj-123");
    formData.append("rating", "5");
    formData.append("reviewerName", "Tariqul Islam");
    formData.append("body", "Flawless migration delivery.");
    formData.append("locale", "en");

    const result = await submitProjectReview(formData);
    expect(result.success).toBe(false);
    expect(result.error).toBe("unauthorized");
  });

  it("updates existing portal review when one already exists for the project", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-client-1", email: "client@example.com" } },
      error: null,
    });

    const existingChain: Record<string, unknown> = {};
    existingChain.select = vi.fn().mockReturnValue(existingChain);
    existingChain.eq = vi.fn().mockReturnValue(existingChain);
    existingChain.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "rev-existing-01" },
      error: null,
    });

    const updateChain: Record<string, unknown> = {};
    updateChain.update = vi.fn().mockReturnValue(updateChain);
    updateChain.eq = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "reviews") {
        return {
          select: existingChain.select,
          update: updateChain.update,
        };
      }
      return {};
    });

    const formData = new FormData();
    formData.append("projectId", "proj-123");
    formData.append("rating", "5");
    formData.append("reviewerName", "Tariqul Islam");
    formData.append("body", "Updated review after production release.");
    formData.append("locale", "en");

    const result = await submitProjectReview(formData);
    expect(result.success).toBe(true);
    expect(result.reviewId).toBe("rev-existing-01");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/portal/projects/proj-123");
  });

  it("inserts new portal review when no previous review exists", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-client-1", email: "client@example.com" } },
      error: null,
    });

    const selectChain: Record<string, unknown> = {};
    selectChain.select = vi.fn().mockReturnValue(selectChain);
    selectChain.eq = vi.fn().mockReturnValue(selectChain);
    selectChain.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const insertChain: Record<string, unknown> = {};
    insertChain.insert = vi.fn().mockReturnValue(insertChain);
    insertChain.select = vi.fn().mockReturnValue(insertChain);
    insertChain.single = vi.fn().mockResolvedValue({
      data: { id: "rev-new-02" },
      error: null,
    });

    mocks.from.mockImplementation((table: string) => {
      if (table === "reviews") {
        return {
          select: selectChain.select,
          insert: insertChain.insert,
        };
      }
      return {};
    });

    const formData = new FormData();
    formData.append("projectId", "proj-123");
    formData.append("rating", "4");
    formData.append("reviewerName", "ফারহানা আহমেদ");
    formData.append("reviewerTitle", "সিটিও");
    formData.append("body", "দারুণ আর্কিটেকচার এবং দ্রুত সাপোর্ট।");
    formData.append("locale", "bn");

    const result = await submitProjectReview(formData);
    expect(result.success).toBe(true);
    expect(result.reviewId).toBe("rev-new-02");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/bn/portal/projects/proj-123");
  });
});
