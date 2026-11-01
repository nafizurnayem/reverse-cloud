import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/guards";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ChatWidget } from "@/components/chat";
import { signOut } from "@/app/[locale]/(auth)/actions";

export default async function PortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { supabase, user } = await requireUser(locale);
  const { data: staffRoles, error: staffError } = await supabase
    .from("staff_roles")
    .select("role_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);
  if (staffError || !Array.isArray(staffRoles)) throw new Error("Unable to verify portal access");
  if (staffRoles.length) redirect(`/${locale}/admin`);
  const isBn = locale === "bn";
  const accountHref = `/${locale}/portal`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header accountHref={accountHref} />
      <nav className="border-b border-border bg-card/70" aria-label={isBn ? "পোর্টাল নেভিগেশন" : "Portal navigation"}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm sm:px-6 lg:px-8">
          <Link href={accountHref} className="font-semibold text-foreground hover:text-primary">
            {isBn ? "আমার প্রজেক্ট" : "My projects"}
          </Link>
          <Link href={`/${locale}/portal/payments`} className="font-semibold text-foreground hover:text-primary">
            {isBn ? "পেমেন্ট" : "Payments"}
          </Link>
          <form action={signOut.bind(null, locale)} className="ml-auto">
            <button type="submit" className="font-semibold text-muted-foreground hover:text-foreground">
              {isBn ? "সাইন আউট" : "Sign out"}
            </button>
          </form>
        </div>
      </nav>
      <main id="main-content" tabIndex={-1} className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full focus:outline-none">
        {children}
      </main>
      <Footer accountHref={accountHref} />
      <ChatWidget />
    </div>
  );
}
