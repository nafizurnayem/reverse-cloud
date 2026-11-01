"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";

export function Header({ accountHref = null }: { accountHref?: string | null }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const locale = useLocale();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Track pathname changes to close mobile drawer during navigation without cascading effect
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileMenuOpen(false);
  }

  // Handle Escape key to close mobile menu for accessibility
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }
    if (isMobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur-md transition-all">
      {/* Skip to Main Content Link for Keyboard and Screen Reader Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-primary-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {locale === "bn" ? "মূল কন্টেন্টে যান" : "Skip to main content"}
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-5">
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
            <span className="hidden text-lg font-bold tracking-tight min-[420px]:inline">{t("brand")}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-4 xl:flex" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap text-xs font-medium transition-colors hover:text-foreground",
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
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden xl:block"><LanguageSwitcher /></div>

          <Link
            href={accountHref ?? "/login"}
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground shadow-subtle transition-all hover:bg-accent hover:text-accent-foreground sm:px-3.5 sm:text-sm"
          >
            {accountHref ? t(accountHref.endsWith("/admin") || accountHref.endsWith("/portal") ? "dashboard" : "account") : t("login")}
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted xl:hidden transition-colors"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={
              isMobileMenuOpen
                ? locale === "bn"
                  ? "মেনু বন্ধ করুন"
                  : "Close menu"
                : locale === "bn"
                ? "মেনু খুলুন"
                : "Open menu"
            }
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label={t("brand")}
          className="fixed inset-x-0 top-16 z-50 border-b border-border bg-background/95 backdrop-blur-md px-4 py-6 shadow-xl xl:hidden"
        >
          <nav className="flex flex-col space-y-3" aria-label="Mobile Navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                    isActive
                      ? "bg-primary/10 font-bold text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 border-t border-border pt-4"><LanguageSwitcher /></div>
        </div>
      )}
    </header>
  );
}
