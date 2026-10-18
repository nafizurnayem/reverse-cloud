import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

import { getApprovedReviews, REVIEWS_CATALOG } from "@/lib/reviews-catalog";
import { fetchMeetingTypes, fetchSignedInClientPrefill } from "@/lib/schedule-server";
import { getMockEvents, sampleBookingProposal } from "@/lib/chat/mock-stream";
import { POST as confirmBookingPost } from "@/app/api/chat/confirm-booking/route";
import { validateReviewInput } from "@/lib/portal/portal-review-values";
import { submitProjectReview } from "@/lib/portal/portal-review-action";
import { moderateReview, saveReview } from "@/app/[locale]/admin/reviews/actions";
import { calculateClientProgress } from "@/lib/portal/portal-calc";

describe("Phase 4 End-to-End Suite (Task 4.9)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("1. Public Site & Homepage Reviews Display (Task 4.4)", () => {
    it("provides rich curated testimonials in both English and Bengali", () => {
      const enReviews = REVIEWS_CATALOG.filter((r) => r.locale === "en");
      const bnReviews = REVIEWS_CATALOG.filter((r) => r.locale === "bn");

      expect(enReviews.length).toBeGreaterThanOrEqual(2);
      expect(bnReviews.length).toBeGreaterThanOrEqual(2);

      for (const review of REVIEWS_CATALOG) {
        expect(review.rating).toBe(5);
        expect(review.reviewer_name).toBeTruthy();
        expect(review.body).toBeTruthy();
      }
    });

    it("falls back gracefully when the database has no approved reviews", async () => {
      const selectChain: Record<string, unknown> = {};
      selectChain.select = vi.fn().mockReturnValue(selectChain);
      selectChain.eq = vi.fn().mockReturnValue(selectChain);
      selectChain.order = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      mocks.from.mockReturnValue(selectChain);

      const reviews = await getApprovedReviews("en");
      expect(reviews.length).toBeGreaterThan(0);
      expect(reviews[0].reviewer_name).toBe(REVIEWS_CATALOG.find((r) => r.locale === "en")?.reviewer_name);
    });
  });

  describe("2. Schedule Flow & Meeting Configuration (Task 4.2)", () => {
    it("provides active meeting types with exact durations", async () => {
      const types = await fetchMeetingTypes("en");
      expect(types).toHaveLength(2);
      expect(types.find((t) => t.key === "discovery_call")?.durationMinutes).toBe(30);
      expect(types.find((t) => t.key === "technical_consult")?.durationMinutes).toBe(45);
    });

    it("detects unauthenticated visitor for booking prefill", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const prefill = await fetchSignedInClientPrefill();
      expect(prefill.isSignedIn).toBe(false);
      expect(prefill.email).toBe("");
    });
  });

  describe("3. Chat AI & Booking Confirmation Cards (Task 4.3)", () => {
    it("emits booking proposal events and card data in both languages", () => {
      const enEvents = getMockEvents("booking_proposal", "en");
      const bnEvents = getMockEvents("booking_proposal", "bn");

      expect(enEvents.some((e) => e.event === "card" && (e.data as { type: string }).type === "booking_proposal")).toBe(true);
      expect(bnEvents.some((e) => e.event === "card" && (e.data as { type: string }).type === "booking_proposal")).toBe(true);
    });

    it("requires human authentication to claim a proposed slot", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Unauthorized") });

      const req = new NextRequest("http://localhost/api/chat/confirm-booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: sampleBookingProposal.proposalId }),
      });

      const res = await confirmBookingPost(req);
      expect(res.status).toBe(401);
    });

    it("atomically confirms an open booking proposal for a signed-in user", async () => {
      mocks.getUser.mockResolvedValue({
        data: { user: { id: "user-client-1", email: "client@example.com" } },
        error: null,
      });

      const updateChain: Record<string, unknown> = {};
      updateChain.eq = vi.fn().mockReturnValue(updateChain);
      updateChain.gt = vi.fn().mockReturnValue(updateChain);
      updateChain.select = vi.fn().mockReturnValue(updateChain);
      updateChain.maybeSingle = vi.fn().mockResolvedValue({
        data: {
          id: sampleBookingProposal.proposalId,
          status: "confirmed",
          starts_at: sampleBookingProposal.startsAt,
        },
        error: null,
      });

      mocks.from.mockReturnValue({ update: vi.fn().mockReturnValue(updateChain) });

      const req = new NextRequest("http://localhost/api/chat/confirm-booking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: sampleBookingProposal.proposalId }),
      });

      const res = await confirmBookingPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.status).toBe("confirmed");
    });
  });

  describe("4. Client Portal & Review Submission (Task 4.4)", () => {
    it("maintains milestone progress isolation for client portal", () => {
      const progress = calculateClientProgress([
        {
          id: "m-1",
          title: "Public Milestone",
          description: "",
          weight: 50,
          progress: 100,
          isClientVisible: true,
          status: "completed",
          targetDate: "2026-10-01",
        },
        {
          id: "m-2",
          title: "Internal Milestone",
          description: "",
          weight: 50,
          progress: 20,
          isClientVisible: false,
          status: "in_progress",
          targetDate: "2026-10-15",
        },
      ]);
      expect(progress).toBe(100);
    });

    it("validates review inputs and enforces rating and length bounds", () => {
      const invalid = validateReviewInput({
        projectId: "proj-1",
        rating: 6,
        reviewerName: "Test",
        body: "Short",
        locale: "en",
      });
      expect(invalid.valid).toBe(false);

      const valid = validateReviewInput({
        projectId: "proj-1",
        rating: 5,
        reviewerName: "John Doe",
        body: "Outstanding engineering delivery on schedule.",
        locale: "en",
      });
      expect(valid.valid).toBe(true);
    });

    it("submits a portal review for a verified project", async () => {
      mocks.getUser.mockResolvedValue({
        data: { user: { id: "user-client-1", email: "client@example.com" } },
        error: null,
      });

      const selectChain: Record<string, unknown> = {};
      selectChain.select = vi.fn().mockReturnValue(selectChain);
      selectChain.eq = vi.fn().mockReturnValue(selectChain);
      selectChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      const insertChain: Record<string, unknown> = {};
      insertChain.insert = vi.fn().mockReturnValue(insertChain);
      insertChain.select = vi.fn().mockReturnValue(insertChain);
      insertChain.single = vi.fn().mockResolvedValue({
        data: { id: "review-new-123" },
        error: null,
      });

      mocks.from.mockReturnValue({
        select: selectChain.select,
        insert: insertChain.insert,
      });

      const formData = new FormData();
      formData.set("projectId", "proj-alpha");
      formData.set("rating", "5");
      formData.set("reviewerName", "Tariqul Islam");
      formData.set("body", "Exceptional cloud architecture and zero-downtime deployment.");
      formData.set("locale", "en");

      const result = await submitProjectReview(formData);
      expect(result.success).toBe(true);
      expect(result.reviewId).toBe("review-new-123");
    });
  });

  describe("5. Admin Moderation & Manual Add (Task 4.4)", () => {
    it("moderates review status with moderator attribution", async () => {
      mocks.requirePermission.mockResolvedValue({
        user: { id: "moderator-uuid-99" },
        supabase: { from: mocks.from },
      });

      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mocks.from.mockReturnValue(updateChain);

      const formData = new FormData();
      formData.set("locale", "en");
      formData.set("id", "review-pending-1");
      formData.set("status", "approved");

      await expect(moderateReview(formData)).rejects.toThrow("redirect:/en/admin/reviews?saved=1");
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "approved",
          moderated_by: "moderator-uuid-99",
        }),
      );
    });

    it("saves manual reviews with bounded rating and redirect", async () => {
      mocks.requirePermission.mockResolvedValue({
        user: { id: "moderator-uuid-99" },
        supabase: { from: mocks.from },
      });

      const insertChain = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mocks.from.mockReturnValue(insertChain);

      const formData = new FormData();
      formData.set("locale", "en");
      formData.set("reviewer_name", "Sarah Connor");
      formData.set("rating", "7"); // Oversized rating
      formData.set("body", "Exceptional security posture.");
      formData.set("status", "approved");

      await expect(saveReview(formData)).rejects.toThrow("redirect:/en/admin/reviews?saved=1");
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewer_name: "Sarah Connor",
          rating: 5, // Capped to 5
          status: "approved",
          moderated_by: "moderator-uuid-99",
        }),
      );
    });
  });
});
