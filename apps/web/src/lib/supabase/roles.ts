import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function isActiveAdmin(supabase: SupabaseClient, userId: string) {
  try {
    const { data, error } = await supabase
      .from("staff_roles")
      .select("roles!inner(key)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("roles.key", "admin")
      .limit(1);

    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}
