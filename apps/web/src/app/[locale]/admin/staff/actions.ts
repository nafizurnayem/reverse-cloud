"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { staffRoleStatusPayload } from "@/lib/admin/staff-values";
import { requirePermission } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function localeFrom(formData: FormData): Locale {
  const value = text(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function staffPath(locale: Locale, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return `/${locale}/admin/staff${query}`;
}

export async function setStaffRoleStatus(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase } = await requirePermission(locale, "staff.manage");
  const payload = staffRoleStatusPayload(formData);
  if (!payload) redirect(staffPath(locale, { error: "invalidInput" }));

  const result = await supabase.rpc("set_staff_role_status", {
    p_user_id: payload.userId,
    p_role_id: payload.roleId,
    p_is_active: payload.isActive,
  });

  if (result.error || result.data !== true) {
    const code = result.error?.message?.includes("last_active_admin")
      ? "lastActiveAdmin"
      : "saveFailed";
    redirect(staffPath(locale, { error: code }));
  }

  revalidatePath(staffPath(locale));
  revalidatePath(`/${locale}/admin`, "layout");
  redirect(staffPath(locale, { saved: payload.isActive ? "activated" : "deactivated" }));
}
