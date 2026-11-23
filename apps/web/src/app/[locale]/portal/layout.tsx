import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { staffDashboardSegmentForRoles } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/guards";
import { getActiveStaffRoleKeys } from "@/lib/supabase/roles";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ChatWidget } from "@/components/chat";
import { fetchClientProjects } from "@/lib/portal/portal-server";
import { calculatePaymentAlerts } from "@/lib/portal/portal-calc";
import { cn } from "@/lib/utils";
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
  const staffRoleKeys = await getActiveStaffRoleKeys(supabase, user.id);
  if (!staffRoleKeys) throw new Error("Unable to verify portal access");
  if (staffRoleKeys.length) redirect(`/${staffDashboardSegmentForRoles(staffRoleKeys)}`);

  const projects = await fetchClientProjects();
  const paymentAlert = calculatePaymentAlerts(projects);

  const isBn = locale === "bn";
  const accountHref = "/portal";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const rawName =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    "";
  const headerUser = {
    name: rawName,
    email: user.email ?? "",
    avatarUrl:
      (typeof meta?.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta?.picture === "string" && meta.picture) ||
      null,
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header accountHref={accountHref} user={headerUser} />
      <nav className="border-b border-border bg-card/70" aria-label={isBn ? "পোর্টাল নেভিগেশন" : "Portal navigation"}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm sm:px-6 lg:px-8">
          <Link href={accountHref} className="font-semibold text-foreground hover:text-primary">
            {isBn ? "আমার প্রজেক্ট" : "My projects"}
          </Link>
          <Link
            href="/portal/payments"
            className="flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors"
          >
            <span>{isBn ? "পেমেন্ট" : "Payments"}</span>
            {paymentAlert.hasAlert && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                  paymentAlert.severity === "overdue"
                    ? "border border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    : "border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
                )}
              >
                {paymentAlert.severity === "overdue"
                  ? isBn
                    ? "বকেয়া"
                    : "Overdue"
                  : isBn
                  ? "প্রদেয়"
                  : "Due"}
              </span>
            )}
          </Link>
        </div>
      </nav>
      <main id="main-content" tabIndex={-1} className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full focus:outline-none">
        {children}
      </main>
      <Footer accountHref={accountHref} />
      <ChatWidget turnstileSiteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""} />
    </div>
  );
}
