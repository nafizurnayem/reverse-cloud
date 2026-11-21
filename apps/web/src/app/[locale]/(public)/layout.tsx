import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ChatWidget } from "@/components/chat";
import { accountDestination } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/lib/auth/routes";
import { getPublishedServiceGroups } from "@/lib/services-server";

type Props = {
  children: ReactNode;
};

export default async function PublicLayout({ children }: Props) {
  let accountHref: string | null = null;
  let headerUser: { name: string; email: string; avatarUrl?: string | null } | null = null;
  let locale: string = "en";
  try {
    const [supabase, loc] = await Promise.all([createClient(), getLocale()]);
    locale = loc;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      accountHref = await accountDestination(supabase, user.id, locale as Locale);
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const rawName =
        (typeof meta?.full_name === "string" && meta.full_name) ||
        (typeof meta?.name === "string" && meta.name) ||
        "";
      headerUser = {
        name: rawName,
        email: user.email ?? "",
        avatarUrl: (typeof meta?.avatar_url === "string" && meta.avatar_url) ||
                   (typeof meta?.picture === "string" && meta.picture) || null,
      };
    }
  } catch {
    // The public site remains available while authentication is unavailable.
  }

  const serviceGroups = await getPublishedServiceGroups(locale).catch(() => []);

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <Header accountHref={accountHref} user={headerUser} serviceGroups={serviceGroups} locale={locale} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer accountHref={accountHref} />
      <ChatWidget turnstileSiteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""} />
    </div>
  );
}
