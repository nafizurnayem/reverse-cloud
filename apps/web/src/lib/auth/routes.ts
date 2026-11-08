import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import {
  staffDashboardSegments,
  type StaffDashboardSegment,
} from "./permissions";

export type Locale = (typeof routing.locales)[number];

function pathSegments(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (hasLocale(routing.locales, segments[0])) segments.shift();
  return segments;
}

export function staffDashboardRoute(pathname: string): {
  segment: StaffDashboardSegment;
  suffix: string;
} | null {
  const segments = pathSegments(pathname);
  const segment = segments[0];
  if (!staffDashboardSegments.includes(segment as StaffDashboardSegment)) return null;
  return {
    segment: segment as StaffDashboardSegment,
    suffix: segments.length > 1 ? `/${segments.slice(1).join("/")}` : "",
  };
}

export function unlocalizedStaffPath(pathname: string) {
  const route = staffDashboardRoute(pathname);
  return route ? `/${route.segment}${route.suffix}` : null;
}

export function isDashboardDestination(destination: string) {
  try {
    const pathname = new URL(destination, "https://internal.invalid").pathname;
    return Boolean(staffDashboardRoute(pathname)) || protectedArea(pathname) === "portal";
  } catch {
    return false;
  }
}

export function protectedArea(pathname: string) {
  const segments = pathSegments(pathname);
  const area = segments[0];
  if (staffDashboardRoute(pathname)) return "admin";
  return area === "portal" ? area : null;
}

export function localizedPath(pathname: string, locale: Locale) {
  const staffPath = unlocalizedStaffPath(pathname);
  if (staffPath) return staffPath;
  const firstSegment = pathname.split("/")[1];
  return hasLocale(routing.locales, firstSegment)
    ? pathname
    : `/${locale}${pathname}`;
}

export function loginPath(locale: Locale, returnTo: string) {
  return `/${locale}/login?${new URLSearchParams({ next: returnTo })}`;
}

export function needsClientAccountLink(destination: string, locale: Locale) {
  try {
    const pathname = new URL(destination, "https://internal.invalid").pathname.replace(/\/$/, "");
    return pathname === `/${locale}/portal` || pathname.startsWith(`/${locale}/portal/`);
  } catch {
    return false;
  }
}

export function safePostLoginPath(
  value: string | readonly string[] | null | undefined,
  locale: Locale,
  fallback = `/${locale}`,
) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) return fallback;
  const decodedPath = decoded.split(/[?#]/, 1)[0];
  if (decodedPath.split("/").some((segment) => segment === "." || segment === "..")) {
    return fallback;
  }

  try {
    const base = new URL("https://internal.invalid");
    const parsed = new URL(value, base);
    const staffPath = unlocalizedStaffPath(parsed.pathname);
    if (parsed.origin === base.origin && staffPath) {
      return `${staffPath}${parsed.search}${parsed.hash}`;
    }
    const hasSelectedLocale =
      parsed.pathname === `/${locale}` || parsed.pathname.startsWith(`/${locale}/`);
    if (parsed.origin !== base.origin || !hasSelectedLocale) {
      return fallback;
    }
    const authPath = parsed.pathname.replace(/\/$/, "");
    if (authPath === `/${locale}/login` || authPath === `/${locale}/auth/callback`) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function postLoginPathFromQuery(
  next: string | readonly string[] | null | undefined,
  returnTo: string | readonly string[] | null | undefined,
  locale: Locale,
) {
  return safePostLoginPath(next ?? returnTo, locale);
}
