import createMiddleware from "next-intl/middleware";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { trustedPublicOrigin } from "./lib/auth/public-origin";
import { staffDashboardSegmentForRoles } from "./lib/auth/permissions";
import {
  localizedPath,
  loginPath,
  protectedArea,
  staffDashboardRoute,
  unlocalizedStaffPath,
  type Locale,
} from "./lib/auth/routes";
import { getActiveStaffRoleKeys } from "./lib/supabase/roles";
import { refreshSession } from "./lib/supabase/session";

const handleLocale = createMiddleware(routing);

function copyLocaleCookies(source: NextResponse, destination: NextResponse) {
  for (const cookie of source.cookies.getAll()) destination.cookies.set(cookie);
  return destination;
}

function selectedLocale(request: NextRequest, response: NextResponse): Locale {
  const requestLocale = request.nextUrl.pathname.split("/").filter(Boolean)[0];
  if (hasLocale(routing.locales, requestLocale)) return requestLocale;

  for (const header of ["location", "x-middleware-rewrite"]) {
    const value = response.headers.get(header);
    if (!value) continue;
    const candidate = new URL(value, request.url).pathname.split("/").filter(Boolean)[0];
    if (hasLocale(routing.locales, candidate)) return candidate;
  }

  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  return hasLocale(routing.locales, cookieLocale) ? cookieLocale : routing.defaultLocale;
}

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
  const session = await refreshSession(request);
  const area = protectedArea(request.nextUrl.pathname);

  if (area && session.unavailable) {
    return session.applyTo(
      NextResponse.json({ error: "Authentication unavailable" }, { status: 503 }),
      true,
    );
  }

  if (hasLocale(routing.locales, segments[0])) {
    const locale = segments[0];
    const canonicalSegments = [...segments];
    while (hasLocale(routing.locales, canonicalSegments[0])) canonicalSegments.shift();
    const canonical = new URL(
      `/${canonicalSegments.join("/")}${request.nextUrl.search}`,
      trustedPublicOrigin(request.headers),
    );
    const response = NextResponse.redirect(canonical);
    response.cookies.set("NEXT_LOCALE", locale, { path: "/", sameSite: "lax" });
    return session.applyTo(response, Boolean(area));
  }

  const localeResponse = handleLocale(request);
  const staffRoute = staffDashboardRoute(request.nextUrl.pathname);

  if (area) {
    const locale = selectedLocale(request, localeResponse);

    if (!session.userId) {
      const returnTo = localizedPath(request.nextUrl.pathname, locale) + request.nextUrl.search;
      const response = NextResponse.redirect(
        new URL(loginPath(locale, returnTo), trustedPublicOrigin(request.headers)),
      );
      for (const cookie of localeResponse.cookies.getAll()) response.cookies.set(cookie);
      return session.applyTo(response, true);
    }

    if (area === "admin") {
      const roleKeys = session.supabase
        ? await getActiveStaffRoleKeys(session.supabase, session.userId)
        : null;
      if (!roleKeys?.length) {
        return session.applyTo(
          NextResponse.json({ error: "Forbidden" }, { status: 403 }),
          true,
        );
      }

      if (staffRoute) {
        const locale = selectedLocale(request, localeResponse);
        const canonicalSegment = staffDashboardSegmentForRoles(roleKeys);
        const canonicalPath = `/${canonicalSegment}${staffRoute.suffix}`;
        const currentPath = unlocalizedStaffPath(request.nextUrl.pathname);

        if (currentPath !== canonicalPath || request.nextUrl.pathname !== currentPath) {
          const canonical = new URL(
            `${canonicalPath}${request.nextUrl.search}`,
            trustedPublicOrigin(request.headers),
          );
          const response = copyLocaleCookies(localeResponse, NextResponse.redirect(canonical));
          return session.applyTo(response, true);
        }

        const internal = new URL(
          `/${locale}/admin${staffRoute.suffix}${request.nextUrl.search}`,
          request.url,
        );
        const response = copyLocaleCookies(
          localeResponse,
          NextResponse.rewrite(internal, { request: { headers: request.headers } }),
        );
        return session.applyTo(response, true);
      }
    }
  }

  return session.applyTo(applyTrustedRedirectOrigin(localeResponse, request), Boolean(area));
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|v1(?:/|$)|_next(?:/|$)|_vercel(?:/|$)|.*\\..*).*)",
    "/admin/:path*",
    "/developer/:path*",
    "/project_manager/:path*",
    "/portal/:path*",
    "/en/admin/:path*",
    "/bn/admin/:path*",
    "/en/developer/:path*",
    "/bn/developer/:path*",
    "/en/project_manager/:path*",
    "/bn/project_manager/:path*",
    "/en/portal/:path*",
    "/bn/portal/:path*",
  ],
};
