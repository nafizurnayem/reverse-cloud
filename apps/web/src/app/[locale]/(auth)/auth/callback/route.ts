import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { safePostLoginPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ locale: string }> };

function loginError(request: NextRequest, locale: string, code: string, next?: string) {
  const url = new URL(`/${locale}/login`, request.url);
  url.searchParams.set("error", code);
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest, { params }: Context) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next = safePostLoginPath(request.nextUrl.searchParams.get("next"), locale);
  if (request.nextUrl.searchParams.has("error")) {
    return loginError(request, locale, "oauth_denied", next);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return loginError(request, locale, "invalid_callback", next);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return loginError(request, locale, "oauth_callback_failed", next);
  } catch {
    return loginError(request, locale, "oauth_callback_failed", next);
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
