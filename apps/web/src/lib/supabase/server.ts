import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicSupabaseEnv } from "./env";

export async function createClient() {
  const { url, key } = requirePublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch (error) {
          // Server Components cannot write cookies; proxy.ts refreshes them.
          // Route Handlers and Server Actions can write, so surface other errors.
          if (
            !(error instanceof Error) ||
            !error.message.includes("Cookies can only be modified")
          ) {
            throw error;
          }
        }
      },
    },
  });
}
