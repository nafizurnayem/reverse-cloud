"use server";

import { hasLocale } from "next-intl";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { safePostLoginPath, type Locale } from "@/lib/auth/routes";
import { requireSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function checkedLocale(value: string): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

export async function signInWithGoogle(localeValue: string, nextValue: string) {
  const locale = checkedLocale(localeValue);
  const next = safePostLoginPath(nextValue, locale);

  let providerUrl: string | null = null;
  try {
    const callback = new URL(`/${locale}/auth/callback`, requireSiteUrl());
    callback.searchParams.set("next", next);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
      },
    });
    if (!error) providerUrl = data.url;
  } catch {
    // The localized login page displays a stable error without exposing details.
  }

  if (!providerUrl) {
    redirect(`/${locale}/login?error=oauth_start_failed&next=${encodeURIComponent(next)}`);
  }
  redirect(providerUrl);
}

export async function signOut(localeValue: string) {
  const locale = checkedLocale(localeValue);
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  } catch {
    redirect(`/${locale}/login?error=sign_out_failed`);
  }
  redirect(`/${locale}/login?logged_out=1`);
}
