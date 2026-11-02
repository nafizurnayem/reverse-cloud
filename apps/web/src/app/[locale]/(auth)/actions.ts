"use server";

import { hasLocale } from "next-intl";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { loginPath, needsClientAccountLink, safePostLoginPath, type Locale } from "@/lib/auth/routes";
import { requireSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function checkedLocale(value: string): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function checkedEmail(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || /[\r\n]/.test(email)) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
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

export async function signInWithMagicLink(
  localeValue: string,
  nextValue: string,
  formData: FormData,
) {
  const locale = checkedLocale(localeValue);
  const next = safePostLoginPath(nextValue, locale);
  const email = checkedEmail(formData.get("email"));
  if (!email) {
    redirect(`/${locale}/login?error=invalid_email&next=${encodeURIComponent(next)}`);
  }

  try {
    const callback = new URL(`/${locale}/auth/callback`, requireSiteUrl());
    callback.searchParams.set("method", "magic_link");
    callback.searchParams.set("next", next);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  } catch {
    redirect(`/${locale}/login?error=magic_link_start_failed&next=${encodeURIComponent(next)}`);
  }

  redirect(`/${locale}/login?magic_link_sent=1&next=${encodeURIComponent(next)}`);
}

export async function continueWithClientAccount(localeValue: string, nextValue: string) {
  const locale = checkedLocale(localeValue);
  const next = safePostLoginPath(nextValue, locale);
  let signedIn = false;
  let linked = false;
  try {
    const supabase = await createClient();
    const userResult = await supabase.auth.getUser();
    signedIn = !userResult.error && Boolean(userResult.data.user);
    if (signedIn && needsClientAccountLink(next, locale)) {
      const result = await supabase.rpc("link_my_client_account");
      linked = !result.error && typeof result.data === "string";
    } else if (signedIn) {
      linked = true;
    }
  } catch {
    // The localized login page displays the stable account-link error below.
  }

  if (!signedIn) redirect(loginPath(locale, next));
  if (!linked) {
    redirect(`/${locale}/login?error=account_link_failed&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
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
  redirect(`/${locale}`);
}
