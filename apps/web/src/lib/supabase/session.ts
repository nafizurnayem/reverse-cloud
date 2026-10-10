import "server-only";

import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseEnv } from "./env";

type Cookie = Parameters<SetAllCookies>[0][number];

export async function refreshSession(request: NextRequest) {
  const pendingCookies = new Map<string, Cookie>();
  const cacheHeaders: Record<string, string> = {};
  const env = getPublicSupabaseEnv();
  let userId: string | null = null;
  let supabase: SupabaseClient | null = null;
  let unavailable = !env;

  if (env) {
    supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            pendingCookies.set(cookie.name, cookie);
          }
          Object.assign(cacheHeaders, headers);
        },
      },
    });

    try {
      const result = await supabase.auth.getClaims();
      if (!result.error) userId = result.data?.claims?.sub ?? null;
      unavailable = Boolean(
        result.error && (result.error.status === 0 || (result.error.status ?? 0) >= 500),
      );
    } catch {
      unavailable = true;
    }
  }

  return {
    supabase,
    userId,
    unavailable,
    applyTo(response: NextResponse, protectedRoute = false) {
      for (const { name, value, options } of pendingCookies.values()) {
        response.cookies.set(name, value, options);
      }
      for (const [name, value] of Object.entries(cacheHeaders)) {
        response.headers.set(name, value);
      }
      if (protectedRoute || userId || pendingCookies.size) {
        response.headers.set("Cache-Control", "private, no-store, max-age=0");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
      }
      return response;
    },
  };
}
