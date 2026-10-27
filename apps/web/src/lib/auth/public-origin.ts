import { requireSiteUrl } from "@/lib/supabase/env";

const httpProtocols = new Set(["http:", "https:"]);

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function exactOrigin(value: string, variable: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} must contain valid HTTP(S) origins.`);
  }

  if (
    !httpProtocols.has(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${variable} must contain exact HTTP(S) origins.`);
  }
  return new URL(url.origin);
}

function configuredSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() ? requireSiteUrl() : null;
}

function trustedOrigins(configured: URL | null) {
  const origins = new Map<string, URL>();
  if (configured) origins.set(configured.origin, configured);

  for (const value of (process.env.TRUSTED_PUBLIC_ORIGINS ?? "").split(",")) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const origin = exactOrigin(trimmed, "TRUSTED_PUBLIC_ORIGINS");
    origins.set(origin.origin, origin);
  }
  return origins;
}

function forwardedOrigin(headers: Headers) {
  const host = firstHeaderValue(headers.get("x-forwarded-host"));
  const protocol = firstHeaderValue(headers.get("x-forwarded-proto"));
  if (!host || (protocol !== "http" && protocol !== "https")) return null;

  try {
    return exactOrigin(`${protocol}://${host}`, "forwarded origin");
  } catch {
    return null;
  }
}

/**
 * Returns an origin that is safe to use in absolute redirects.
 * Forwarded headers are honored only when their exact origin is configured.
 */
export function trustedPublicOrigin(headers: Headers) {
  const configured = configuredSiteUrl();
  const allowed = trustedOrigins(configured);
  const forwarded = forwardedOrigin(headers);

  if (forwarded && allowed.has(forwarded.origin)) return forwarded;
  if (configured) return configured;

  throw new Error(
    "Configure NEXT_PUBLIC_SITE_URL or an allow-listed forwarded origin in TRUSTED_PUBLIC_ORIGINS.",
  );
}
