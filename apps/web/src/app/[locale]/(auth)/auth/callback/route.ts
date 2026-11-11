import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { staffDashboardSegmentForRoles } from "@/lib/auth/permissions";
import { trustedPublicOrigin } from "@/lib/auth/public-origin";
import { protectedArea, safePostLoginPath } from "@/lib/auth/routes";
import { inviteTokenFromDestination } from "@/lib/invites/routes";
import { getActiveStaffRoleKeys } from "@/lib/supabase/roles";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ locale: string }> };

function loginError(origin: URL, locale: string, code: string, next?: string) {
  void locale;
  const url = new URL("/login", origin);
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
  const publicSiteUrl = trustedPublicOrigin(request.headers);
  const magicLink = request.nextUrl.searchParams.get("method") === "magic_link";
  if (request.nextUrl.searchParams.has("error")) {
    return loginError(publicSiteUrl, locale, magicLink ? "magic_link_invalid" : "oauth_denied", next);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return loginError(publicSiteUrl, locale, magicLink ? "magic_link_invalid" : "invalid_callback", next);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginError(publicSiteUrl, locale, magicLink ? "magic_link_invalid" : "oauth_callback_failed", next);
    }
  } catch {
    return loginError(publicSiteUrl, locale, magicLink ? "magic_link_invalid" : "oauth_callback_failed", next);
  }

  const inviteToken = inviteTokenFromDestination(next, locale);
  if (inviteToken) {
    try {
      const { data, error } = await supabase.rpc("accept_client_invite", { p_token: inviteToken });
      if (error || typeof data !== "string") {
        const rejected = new URL("/accept-invite", publicSiteUrl);
        rejected.searchParams.set("error", "invalid_or_expired_invite");
        return privateRedirect(rejected);
      }
    } catch {
      const rejected = new URL("/accept-invite", publicSiteUrl);
      rejected.searchParams.set("error", "invalid_or_expired_invite");
      return privateRedirect(rejected);
    }
    return privateRedirect(new URL("/portal?invite=accepted", publicSiteUrl));
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return loginError(publicSiteUrl, locale, "oauth_callback_failed", next);

    const { error: inviteError } = await supabase.rpc("claim_my_staff_invites");
    if (inviteError) return loginError(publicSiteUrl, locale, "account_link_failed", next);

    // Staff are never provisioned as clients, even if they opened a portal link.
    const staffRoleKeys = await getActiveStaffRoleKeys(supabase, user.id);
    if (!staffRoleKeys) return loginError(publicSiteUrl, locale, "account_link_failed", next);
    if (staffRoleKeys.length) {
      return privateRedirect(
        new URL(`/${staffDashboardSegmentForRoles(staffRoleKeys)}`, publicSiteUrl),
      );
    }

    const { data: existingClient, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (clientError) return loginError(publicSiteUrl, locale, "account_link_failed", next);

    const { data: linkedClientId, error: linkError } = await supabase.rpc("link_my_client_account");
    if (linkError || typeof linkedClientId !== "string") {
      return loginError(publicSiteUrl, locale, "account_link_failed", next);
    }

    // The first sign-in always opens the portal. Returning clients keep safe
    // deep links, but an admin URL is never a client destination.
    const destination = !existingClient || next === "/" || protectedArea(next) === "admin"
      ? "/portal"
      : next;
    return privateRedirect(new URL(destination, publicSiteUrl));
  } catch {
    return loginError(publicSiteUrl, locale, "account_link_failed", next);
  }
}
