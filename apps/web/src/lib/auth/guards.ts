import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isActiveAdmin } from "@/lib/supabase/roles";
import { loginPath, type Locale } from "./routes";

export async function requireUser(locale: Locale, returnTo = `/${locale}/portal`) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(loginPath(locale, returnTo));
  return { supabase, user: data.user };
}

export async function requireAdmin(locale: Locale) {
  const session = await requireUser(locale, `/${locale}/admin`);
  if (!(await isActiveAdmin(session.supabase, session.user.id))) notFound();
  return session;
}
