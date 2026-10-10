export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return url && key ? { url, key } : null;
}

export function requirePublicSupabaseEnv() {
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in apps/web/.env.local.",
    );
  }
  return env;
}

export function requireSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) {
    throw new Error("Configure NEXT_PUBLIC_SITE_URL in apps/web/.env.local.");
  }

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin.");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}
