"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";

export function Header() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/services", label: t("services") },
    { href: "/portfolio", label: t("portfolio") },
    { href: "/pricing", label: t("pricing") },
    { href: "/blog", label: t("blog") },
    { href: "/about", label: t("about") },
    { href: "/wizard", label: t("wizard") },
    { href: "/schedule", label: t("schedule") },
    { href: "/contact", label: t("contact") },
  ];


  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-lg bg-[#b8dc6f] font-extrabold text-[#15261f] shadow-sm"
              aria-hidden="true"
            >
              R
            </span>
            <span className="text-lg font-bold tracking-tight">{t("brand")}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-foreground",
                    isActive
                      ? "font-semibold text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-subtle transition-all hover:bg-accent hover:text-accent-foreground sm:text-sm"
          >
            {t("login")}
          </Link>
        </div>
      </div>
    </header>
  );
}
