"use server";

import { hasLocale } from "next-intl";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { loginPath, type Locale } from "@/lib/auth/routes";
import { acceptInvitePath, validInviteToken } from "@/lib/invites/routes";
import { createClient } from "@/lib/supabase/server";

function checkedLocale(value: string): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function inviteErrorPath(locale: Locale) {
  void locale;
  return "/accept-invite?error=invalid_or_expired_invite";
}

export async function acceptClientInvite(localeValue: string, tokenValue: string) {
  const locale = checkedLocale(localeValue);
  const token = validInviteToken(tokenValue);
  if (!token) redirect(inviteErrorPath(locale));

  let signedIn = false;
  let accepted = false;
  try {
    const supabase = await createClient();
    const userResult = await supabase.auth.getUser();
    signedIn = !userResult.error && Boolean(userResult.data.user);
    if (signedIn) {
      const result = await supabase.rpc("accept_client_invite", { p_token: token });
      accepted = !result.error && typeof result.data === "string";
    }
  } catch {
    // The page displays one stable message for every rejected invitation.
  }

  if (!signedIn) redirect(loginPath(locale, acceptInvitePath(locale, token)));
  if (!accepted) redirect(inviteErrorPath(locale));
  redirect("/portal?invite=accepted");
}
