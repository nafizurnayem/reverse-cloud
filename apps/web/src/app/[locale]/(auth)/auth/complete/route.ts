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
  try {
    const supabase = await createClient();
    return completeSignIn(request, locale, next, supabase);
  } catch {
    return loginError(request, "oauth_callback_failed", next);
  }
}
