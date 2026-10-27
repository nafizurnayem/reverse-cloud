import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { trustedPublicOrigin } from "./lib/auth/public-origin";
import { localizedPath, loginPath, protectedArea } from "./lib/auth/routes";
import { isActiveStaff } from "./lib/supabase/roles";
import { refreshSession } from "./lib/supabase/session";

const handleLocale = createMiddleware(routing);

function applyTrustedRedirectOrigin(response: NextResponse, request: NextRequest) {
  const location = response.headers.get("location");
  if (!location) return response;

  const destination = new URL(location, request.url);
  const safeDestination = new URL(
    `${destination.pathname}${destination.search}${destination.hash}`,
    trustedPublicOrigin(request.headers),
  );
  response.headers.set("location", safeDestination.toString());
  return response;
}

export async function proxy(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (
    segments.length > 1 &&
    hasLocale(routing.locales, segments[0]) &&
    segments[0] === segments[1]
  ) {
    const canonical = new URL(
      `/${segments[0]}/${segments.slice(2).join("/")}${request.nextUrl.search}`,
      trustedPublicOrigin(request.headers),
    );
    return NextResponse.redirect(canonical);
  }

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
      const response = NextResponse.redirect(
        new URL(loginPath(locale, returnTo), trustedPublicOrigin(request.headers)),
      );
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

  return session.applyTo(applyTrustedRedirectOrigin(localeResponse, request), Boolean(area));
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
