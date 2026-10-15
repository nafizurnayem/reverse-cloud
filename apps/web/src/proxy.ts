import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { localizedPath, loginPath, protectedArea } from "./lib/auth/routes";
import { isActiveStaff } from "./lib/supabase/roles";
import { refreshSession } from "./lib/supabase/session";

const handleLocale = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const session = await refreshSession(request);
  const localeResponse = handleLocale(request);
  const area = protectedArea(request.nextUrl.pathname);

  if (area) {
    if (session.unavailable) {
      return session.applyTo(
        NextResponse.json({ error: "Authentication unavailable" }, { status: 503 }),
        true,
      );
    }

    const destination = localeResponse.headers.get("location") ?? request.url;
    const candidate = new URL(destination, request.url).pathname.split("/")[1];
    const locale = hasLocale(routing.locales, candidate)
      ? candidate
      : routing.defaultLocale;

    if (!session.userId) {
      const returnTo = localizedPath(request.nextUrl.pathname, locale) + request.nextUrl.search;
      const response = NextResponse.redirect(new URL(loginPath(locale, returnTo), request.url));
      for (const cookie of localeResponse.cookies.getAll()) response.cookies.set(cookie);
      return session.applyTo(response, true);
    }

    if (
      area === "admin" &&
      (!session.supabase || !(await isActiveStaff(session.supabase, session.userId)))
    ) {
      return session.applyTo(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        true,
      );
    }
  }

  return session.applyTo(localeResponse, Boolean(area));
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|v1(?:/|$)|_next(?:/|$)|_vercel(?:/|$)|.*\\..*).*)",
    "/admin/:path*",
    "/portal/:path*",
    "/en/admin/:path*",
    "/bn/admin/:path*",
    "/en/portal/:path*",
    "/bn/portal/:path*",
  ],
};
