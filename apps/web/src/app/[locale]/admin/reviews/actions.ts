"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";
import { staffDashboardPath } from "@/lib/auth/permissions";
import { checkbox, integer, optionalText, text } from "@/lib/admin/content-values";

function formLocale(formData: FormData): Locale {
  const value = text(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

export async function saveReview(formData: FormData) {
  const locale = formLocale(formData);
  const { supabase, user, access } = await requirePermission(locale, "reviews.moderate");
  const path = staffDashboardPath(access, "/reviews");
  const id = text(formData, "id");
  const reviewerName = text(formData, "reviewer_name");
  const body = text(formData, "body");
  if (!reviewerName || !body) redirect(`${path}?error=invalidInput`);
  const status = text(formData, "status") || "pending";
  const payload = {
    reviewer_name: reviewerName, reviewer_title: optionalText(formData, "reviewer_title"),
    rating: Math.min(5, Math.max(1, integer(formData, "rating", 5))), body,
    locale: text(formData, "review_locale") === "bn" ? "bn" : "en",
    source: text(formData, "source") || "manual", source_url: optionalText(formData, "source_url"),
    status, is_featured: checkbox(formData, "is_featured"),
    moderated_by: status === "pending" ? null : user.id,
    moderated_at: status === "pending" ? null : new Date().toISOString(),
  };
  const result = id
    ? await supabase.from("reviews").update(payload).eq("id", id)
    : await supabase.from("reviews").insert(payload);
  if (result.error) redirect(`${path}?error=saveFailed`);
  revalidatePath(`/${locale}/admin/reviews`);
  for (const loc of routing.locales) revalidatePath(`/${loc}`);
  redirect(`${path}?saved=1`);
}

export async function moderateReview(formData: FormData) {
  const locale = formLocale(formData);
  const { supabase, user, access } = await requirePermission(locale, "reviews.moderate");
  const path = staffDashboardPath(access, "/reviews");
  const id = text(formData, "id");
  const targetStatus = text(formData, "status");

  if (!id || !["approved", "rejected", "pending"].includes(targetStatus)) {
    redirect(`${path}?error=invalidInput`);
  }

  const result = await supabase
    .from("reviews")
    .update({
      status: targetStatus,
      moderated_by: targetStatus === "pending" ? null : user.id,
      moderated_at: targetStatus === "pending" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (result.error) redirect(`${path}?error=saveFailed`);
  revalidatePath(`/${locale}/admin/reviews`);
  for (const loc of routing.locales) revalidatePath(`/${loc}`);
  redirect(`${path}?saved=1`);
}
