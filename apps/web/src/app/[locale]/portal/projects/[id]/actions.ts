"use server";

import {
  submitProjectReview as submitAction,
  type ReviewSubmitResult,
} from "@/lib/portal/portal-review-action";

export async function submitProjectReview(
  formData: FormData,
): Promise<ReviewSubmitResult> {
  return submitAction(formData);
}
