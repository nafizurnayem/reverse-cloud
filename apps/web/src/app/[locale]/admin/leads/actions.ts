"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";
import { staffDashboardPath } from "@/lib/auth/permissions";
import { text } from "@/lib/admin/content-values";

const statuses = new Set(["new", "contacted", "qualified", "converted", "lost"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateLeadStatus(formData: FormData) {
  const rawLocale = text(formData, "locale");
  const locale: Locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const { supabase, access } = await requirePermission(locale, "leads.manage");
  const path = staffDashboardPath(access, "/leads");
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!uuidPattern.test(id) || !statuses.has(status)) redirect(`${path}?error=invalidInput`);

  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) redirect(`${path}?error=saveFailed`);
  revalidatePath(`/${locale}/admin/leads`);
  redirect(`${path}?lead=${id}&saved=1`);
}
