"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { staffRoleStatusPayload } from "@/lib/admin/staff-values";
import { requirePermission } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";
import { staffDashboardPath, type StaffAccess } from "@/lib/auth/permissions";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function localeFrom(formData: FormData): Locale {
  const value = text(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function staffPath(access: StaffAccess, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return `${staffDashboardPath(access, "/staff")}${query}`;
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function addStaffMember(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "staff.manage");
  const email = text(formData, "email").toLowerCase();
  const roleId = text(formData, "role_id");
  if (!validEmail(email) || !validUuid(roleId)) {
    redirect(staffPath(access, { error: "invalidInput" }));
  }

  const lookup = await supabase.rpc("lookup_user_by_email", { p_email: email });
  if (lookup.error) redirect(staffPath(access, { error: "saveFailed" }));
  const row = Array.isArray(lookup.data) ? lookup.data[0] : lookup.data;
  const userId = row && typeof row.user_id === "string" ? row.user_id : "";

  if (validUuid(userId)) {
    const assigned = await supabase.rpc("set_staff_role_status", {
      p_user_id: userId,
      p_role_id: roleId,
      p_is_active: true,
    });
    if (assigned.error || assigned.data !== true) {
      redirect(staffPath(access, { error: "saveFailed" }));
    }

    revalidatePath(`/${locale}/admin/staff`);
    revalidatePath(`/${locale}/admin`, "layout");
    return;
  }

  const preauth = await supabase.rpc("preauthorize_staff_member", {
    p_email: email,
    p_role_id: roleId,
  });
  if (preauth.error) {
    redirect(staffPath(access, { error: "saveFailed" }));
  }

  revalidatePath(`/${locale}/admin/staff`);
  revalidatePath(`/${locale}/admin`, "layout");
}

export async function revokeStaffInvite(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "staff.manage");
  const inviteId = text(formData, "invite_id");
  if (!validUuid(inviteId)) {
    redirect(staffPath(access, { error: "invalidInput" }));
  }

  const result = await supabase.rpc("revoke_staff_invite", { p_invite_id: inviteId });
  if (result.error || result.data !== true) {
    redirect(staffPath(access, { error: "saveFailed" }));
  }

  revalidatePath(`/${locale}/admin/staff`);
  revalidatePath(`/${locale}/admin`, "layout");
}

export async function setStaffRoleStatus(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "staff.manage");
  const payload = staffRoleStatusPayload(formData);
  if (!payload) redirect(staffPath(access, { error: "invalidInput" }));

  const result = await supabase.rpc("set_staff_role_status", {
    p_user_id: payload.userId,
    p_role_id: payload.roleId,
    p_is_active: payload.isActive,
  });

  if (result.error || result.data !== true) {
    const code = result.error?.message?.includes("last_active_admin")
      ? "lastActiveAdmin"
      : "saveFailed";
    redirect(staffPath(access, { error: code }));
  }

  revalidatePath(`/${locale}/admin/staff`);
  revalidatePath(`/${locale}/admin`, "layout");
}
