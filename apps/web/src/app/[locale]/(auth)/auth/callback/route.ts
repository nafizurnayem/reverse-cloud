import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { needsClientAccountLink, safePostLoginPath } from "@/lib/auth/routes";
import { inviteTokenFromDestination } from "@/lib/invites/routes";
import { requireSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ locale: string }> };

function loginError(locale: string, code: string, next?: string) {
  const url = new URL(`/${locale}/login`, requireSiteUrl());
  url.searchParams.set("error", code);
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

function privateRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function GET(request: NextRequest, { params }: Context) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next = safePostLoginPath(request.nextUrl.searchParams.get("next"), locale);
  const publicSiteUrl = requireSiteUrl();
  const magicLink = request.nextUrl.searchParams.get("method") === "magic_link";
  if (request.nextUrl.searchParams.has("error")) {
    return loginError(locale, magicLink ? "magic_link_invalid" : "oauth_denied", next);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return loginError(locale, magicLink ? "magic_link_invalid" : "invalid_callback", next);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginError(locale, magicLink ? "magic_link_invalid" : "oauth_callback_failed", next);
    }
  } catch {
    return loginError(locale, magicLink ? "magic_link_invalid" : "oauth_callback_failed", next);
  }

  const inviteToken = inviteTokenFromDestination(next, locale);
  if (inviteToken) {
    try {
      const { data, error } = await supabase.rpc("accept_client_invite", { p_token: inviteToken });
      if (error || typeof data !== "string") {
        const rejected = new URL(`/${locale}/accept-invite`, publicSiteUrl);
        rejected.searchParams.set("error", "invalid_or_expired_invite");
        return privateRedirect(rejected);
      }
    } catch {
      const rejected = new URL(`/${locale}/accept-invite`, publicSiteUrl);
      rejected.searchParams.set("error", "invalid_or_expired_invite");
      return privateRedirect(rejected);
    }
    return privateRedirect(new URL(`/${locale}/portal?invite=accepted`, publicSiteUrl));
  }

  if (needsClientAccountLink(next, locale)) {
    try {
      const { error } = await supabase.rpc("link_my_client_account");
      if (error) return loginError(locale, "account_link_failed", next);
    } catch {
      return loginError(locale, "account_link_failed", next);
    }
  }

  return privateRedirect(new URL(next, publicSiteUrl));
}
