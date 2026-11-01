import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ChatWidget } from "@/components/chat";
import { accountDestination } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/lib/auth/routes";

type Props = {
  children: ReactNode;
};

export default async function PublicLayout({ children }: Props) {
  let accountHref: string | null = null;
  try {
    const [supabase, locale] = await Promise.all([createClient(), getLocale()]);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) accountHref = await accountDestination(supabase, user.id, locale as Locale);
  } catch {
    // The public site remains available while authentication is unavailable.
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <Header accountHref={accountHref} />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer accountHref={accountHref} />
      <ChatWidget />
    </div>
  );
}
