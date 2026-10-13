import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];

export function protectedArea(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (hasLocale(routing.locales, segments[0])) segments.shift();
  const area = segments[0];
  return area === "admin" || area === "portal" ? area : null;
}

export function localizedPath(pathname: string, locale: Locale) {
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
  fallback = `/${locale}/portal`,
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

  try {
    const base = new URL("https://internal.invalid");
    const parsed = new URL(value, base);
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
