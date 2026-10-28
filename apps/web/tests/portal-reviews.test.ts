import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
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

  it("submits portal review via submit_project_review RPC and revalidates path", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-client-1", email: "client@example.com" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: "rev-rpc-01",
      error: null,
    });

    const formData = new FormData();
    formData.append("projectId", "proj-123");
    formData.append("rating", "5");
    formData.append("reviewerName", "Tariqul Islam");
    formData.append("body", "Updated review after production release.");
    formData.append("locale", "en");

    const result = await submitProjectReview(formData);
    expect(result.success).toBe(true);
    expect(result.reviewId).toBe("rev-rpc-01");
    expect(mocks.rpc).toHaveBeenCalledWith("submit_project_review", {
      p_project_id: "proj-123",
      p_rating: 5,
      p_reviewer_name: "Tariqul Islam",
      p_reviewer_title: null,
      p_body: "Updated review after production release.",
      p_locale: "en",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/portal/projects/proj-123");
  });

  it("handles RPC submission error gracefully", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-client-1", email: "client@example.com" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error("project_not_found_or_forbidden"),
    });

    const formData = new FormData();
    formData.append("projectId", "proj-123");
    formData.append("rating", "4");
    formData.append("reviewerName", "ফারহানা আহমেদ");
    formData.append("reviewerTitle", "সিটিও");
    formData.append("body", "দারুণ আর্কিটেকচার এবং দ্রুত সাপোর্ট।");
    formData.append("locale", "bn");

    const result = await submitProjectReview(formData);
    expect(result.success).toBe(false);
    expect(result.error).toBe("project_not_found_or_forbidden");
  });
});
