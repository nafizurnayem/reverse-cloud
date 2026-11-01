import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveStaff } from "@/lib/supabase/roles";
import type { Locale } from "./routes";

export async function accountDestination(supabase: SupabaseClient, userId: string, locale: Locale) {
  if (await isActiveStaff(supabase, userId)) return `/${locale}/admin`;

  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data?.id) return `/${locale}/portal`;
  } catch {
    // A failed role lookup must never grant portal access.
  }
  return `/${locale}`;
}
