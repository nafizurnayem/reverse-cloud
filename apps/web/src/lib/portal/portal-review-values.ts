export interface ReviewInput {
  projectId: string;
  rating: number;
  reviewerName: string;
  reviewerTitle?: string | null;
  body: string;
  locale: "en" | "bn";
}

export function validateReviewInput(input: Partial<ReviewInput>): {
  valid: boolean;
  error?: string;
  sanitized?: ReviewInput;
} {
  const projectId = (input.projectId ?? "").trim();
  const rawRating = Number(input.rating);
  const reviewerName = (input.reviewerName ?? "").trim();
  const reviewerTitle = (input.reviewerTitle ?? "").trim() || null;
  const body = (input.body ?? "").trim();
  const locale = input.locale === "bn" ? "bn" : "en";

  if (!projectId) {
    return { valid: false, error: "invalid_project" };
  }
  if (!rawRating || isNaN(rawRating) || rawRating < 1 || rawRating > 5 || !Number.isInteger(rawRating)) {
    return { valid: false, error: "invalid_rating" };
  }
  if (!reviewerName || reviewerName.length > 200) {
    return { valid: false, error: "invalid_name" };
  }
  if (reviewerTitle && reviewerTitle.length > 200) {
    return { valid: false, error: "invalid_title" };
  }
  if (!body || body.length < 5 || body.length > 5000) {
    return { valid: false, error: "invalid_body" };
  }

  return {
    valid: true,
    sanitized: {
      projectId,
      rating: rawRating,
      reviewerName,
      reviewerTitle,
      body,
      locale,
    },
  };
}
