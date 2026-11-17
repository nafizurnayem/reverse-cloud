import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { completeSignIn, loginError } from "@/lib/auth/complete-sign-in";
import { safePostLoginPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ locale: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next = safePostLoginPath(request.nextUrl.searchParams.get("next"), locale);
  const magicLink = request.nextUrl.searchParams.get("method") === "magic_link";
  if (request.nextUrl.searchParams.has("error")) {
    return loginError(request, magicLink ? "magic_link_invalid" : "oauth_denied", next);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return loginError(request, magicLink ? "magic_link_invalid" : "invalid_callback", next);
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginError(request, magicLink ? "magic_link_invalid" : "oauth_callback_failed", next);
    }
  } catch {
    return loginError(request, magicLink ? "magic_link_invalid" : "oauth_callback_failed", next);
  }

  return completeSignIn(request, locale, next, supabase);
}
