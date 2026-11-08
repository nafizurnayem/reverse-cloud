"use client";

import Link from "next/link";
import { ArrowLeft, Box, CreditCard, LogOut, Shield } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { signOut } from "@/app/[locale]/(auth)/actions";

interface PortalHeaderProps {
  locale: string;
  clientName?: string;
  companyName?: string;
  showBackToProjects?: boolean;
}

export function PortalHeader({
  locale,
  clientName,
  companyName,
  showBackToProjects = false,
}: PortalHeaderProps) {
  const isBn = locale === "bn";

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <Link
            href={`/${locale}/portal`}
            className="flex items-center gap-2.5 font-bold tracking-tight text-foreground"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Box className="h-5 w-5" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm leading-none font-extrabold text-foreground">
                {isBn ? "ক্লায়েন্ট পোর্টাল" : "Client Portal"}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Reverse Cloud Engine
              </span>
            </div>
          </Link>

          {showBackToProjects && (
            <Link
              href={`/${locale}/portal`}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ml-4"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>{isBn ? "সব প্রজেক্ট" : "All Projects"}</span>
            </Link>
          )}
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={`/${locale}/portal/payments`}
            aria-label={isBn ? "পেমেন্ট" : "Payments"}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBn ? "পেমেন্ট" : "Payments"}</span>
          </Link>

          <LanguageSwitcher />

          {(clientName || companyName) && (
            <div className="hidden max-w-48 break-words md:flex flex-col text-right">
              <span className="text-xs font-semibold text-foreground">
                {clientName || "Client"}
              </span>
              {companyName && (
                <span className="text-[10px] text-muted-foreground">
                  {companyName}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium text-foreground">
              {isBn ? "রিড-অনলি মোড" : "Read-Only"}
            </span>
          </div>

          <form action={signOut.bind(null, locale)}>
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={isBn ? "সাইন আউট" : "Sign out"}
              aria-label={isBn ? "সাইন আউট" : "Sign out"}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
