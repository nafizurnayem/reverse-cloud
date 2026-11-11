import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { staffDashboardSegmentForRoles } from "./permissions";
import { getActiveStaffRoleKeys } from "@/lib/supabase/roles";
import type { Locale } from "./routes";

export async function accountDestination(supabase: SupabaseClient, userId: string, _locale: Locale) {
  void _locale;
  const staffRoleKeys = await getActiveStaffRoleKeys(supabase, userId);
  if (staffRoleKeys?.length) return `/${staffDashboardSegmentForRoles(staffRoleKeys)}`;

  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data?.id) return "/portal";
  } catch {
    // A failed role lookup must never grant portal access.
  }
  return "/";
}
