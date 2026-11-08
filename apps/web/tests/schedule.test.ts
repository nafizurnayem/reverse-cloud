import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  revalidatePath: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  FALLBACK_MEETING_TYPES,
  fetchMeetingTypes,
  fetchSignedInClientPrefill,
} from "@/lib/schedule-server";
import { moderateReview } from "@/app/[locale]/admin/reviews/actions";

describe("Schedule Page & Meeting Configuration", () => {
  it("provides discovery call and technical consult meeting types", () => {
    expect(FALLBACK_MEETING_TYPES.en).toHaveLength(2);
    expect(FALLBACK_MEETING_TYPES.bn).toHaveLength(2);

    const discovery = FALLBACK_MEETING_TYPES.en.find((m) => m.key === "discovery_call");
    expect(discovery).toBeDefined();
    expect(discovery?.durationMinutes).toBe(30);

    const consult = FALLBACK_MEETING_TYPES.en.find((m) => m.key === "technical_consult");
    expect(consult).toBeDefined();
    expect(consult?.durationMinutes).toBe(45);
  });

  it("fetches localized meeting types", async () => {
    const enTypes = await fetchMeetingTypes("en");
    expect(enTypes).toHaveLength(2);
    expect(enTypes[0].name).toBe("Discovery Call");

    const bnTypes = await fetchMeetingTypes("bn");
    expect(bnTypes).toHaveLength(2);
    expect(bnTypes[0].name).toBe("ডিসকভারি কল");
  });

  it("returns unauthenticated prefill when no active session is found", async () => {
    const prefill = await fetchSignedInClientPrefill();
    expect(prefill.isSignedIn).toBe(false);
    expect(prefill.name).toBe("");
    expect(prefill.email).toBe("");
  });
});

describe("Admin Review Moderation Action", () => {
  const reviewId = "00000000-0000-4000-8000-000000000401";
  const moderatorId = "00000000-0000-4000-8000-000000000402";

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requirePermission.mockResolvedValue({
      access: { roles: [{ key: "admin", name: "Admin" }] },
      user: { id: moderatorId },
      supabase: { from: mocks.from },
    });
  });

  it("approves a pending review and records moderator user ID", async () => {
    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mocks.from.mockReturnValue(updateBuilder);

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("id", reviewId);
    formData.set("status", "approved");

    await expect(moderateReview(formData)).rejects.toThrow(
      "redirect:/admin/reviews?saved=1"
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith("en", "reviews.moderate");
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        moderated_by: moderatorId,
      })
    );
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", reviewId);
  });

  it("rejects an unsuitable review", async () => {
    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mocks.from.mockReturnValue(updateBuilder);

    const formData = new FormData();
    formData.set("locale", "bn");
    formData.set("id", reviewId);
    formData.set("status", "rejected");

    await expect(moderateReview(formData)).rejects.toThrow(
      "redirect:/admin/reviews?saved=1"
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith("bn", "reviews.moderate");
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        moderated_by: moderatorId,
      })
    );
  });

  it("fails when id or status is missing", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("id", "");
    formData.set("status", "approved");

    await expect(moderateReview(formData)).rejects.toThrow(
      "redirect:/admin/reviews?error=invalidInput"
    );
  });
});
