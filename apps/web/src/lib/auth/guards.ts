import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffAccess } from "@/lib/supabase/roles";
import { hasAnyPermission, type Permission } from "./permissions";
import { loginPath, type Locale } from "./routes";

export async function requireUser(locale: Locale, returnTo = "/portal") {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(loginPath(locale, returnTo));
  return { supabase, user: data.user };
}

export const requireStaff = cache(async (locale: Locale) => {
  const session = await requireUser(locale, "/admin");
  const access = await getStaffAccess(session.supabase, session.user.id);
  if (!access.isStaff) notFound();
  return { ...session, access };
});

export async function requireAdmin(locale: Locale) {
  const session = await requireStaff(locale);
  if (!session.access.isAdmin) notFound();
  return session;
}

export async function requirePermission(
  locale: Locale,
  permission: Permission | readonly Permission[],
) {
  const session = await requireStaff(locale);
  if (!hasAnyPermission(session.access, permission)) notFound();
  return session;
}
