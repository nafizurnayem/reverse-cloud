import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { staffDashboardSegmentForRoles } from "./permissions";
import { trustedPublicOrigin } from "./public-origin";
import { protectedArea, type Locale } from "./routes";
import { inviteTokenFromDestination } from "@/lib/invites/routes";
import { getActiveStaffRoleKeys } from "@/lib/supabase/roles";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export function loginError(request: NextRequest, code: string, next?: string) {
  const url = new URL("/login", trustedPublicOrigin(request.headers));
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

export async function completeSignIn(
  request: NextRequest,
  locale: Locale,
  next: string,
  supabase: ServerSupabaseClient,
) {
  const publicSiteUrl = trustedPublicOrigin(request.headers);
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
    if (userError || !user) return loginError(request, "oauth_callback_failed", next);

    const { error: inviteError } = await supabase.rpc("claim_my_staff_invites");
    if (inviteError) return loginError(request, "account_link_failed", next);

    // Staff are never provisioned as clients, even if they opened a portal link.
    const staffRoleKeys = await getActiveStaffRoleKeys(supabase, user.id);
    if (!staffRoleKeys) return loginError(request, "account_link_failed", next);
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
    if (clientError) return loginError(request, "account_link_failed", next);

    const { data: linkedClientId, error: linkError } = await supabase.rpc("link_my_client_account");
    if (linkError || typeof linkedClientId !== "string") {
      return loginError(request, "account_link_failed", next);
    }

    // The first sign-in always opens the portal. Returning clients keep safe
    // deep links, but an admin URL is never a client destination.
    const destination = !existingClient || next === "/" || protectedArea(next) === "admin"
      ? "/portal"
      : next;
    return privateRedirect(new URL(destination, publicSiteUrl));
  } catch {
    return loginError(request, "account_link_failed", next);
  }
}
