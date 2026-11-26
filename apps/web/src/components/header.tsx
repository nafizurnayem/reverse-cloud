"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserMenu } from "@/components/user-menu";
import { isDashboardDestination } from "@/lib/auth/routes";
import { cn } from "@/lib/utils";
import { ServicesNavMenu, type ServiceGroup } from "@/components/services-nav-menu";

type HeaderUser = {
  name: string;
  email: string;
  avatarUrl?: string | null;
};

export function Header({
  accountHref = null,
  user = null,
  serviceGroups = [],
  locale: localeProp,
  hasActiveProject = false,
}: {
  accountHref?: string | null;
  user?: HeaderUser | null;
  serviceGroups?: ServiceGroup[];
  locale?: string;
  hasActiveProject?: boolean;
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const localeHook = useLocale();
  const locale = localeProp ?? localeHook;
  const isHome = pathname === "/";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const shouldAnimateConsultation = !hasActiveProject;

  const otherNavLinks = [
    { href: "/", label: t("home") },
    { href: "/portfolio", label: t("portfolio") },
    { href: "/pricing", label: t("pricing") },
    { href: "/blog", label: t("blog") },
    { href: "/about", label: t("about") },
    { href: "/schedule", label: t("schedule") },
    { href: "/contact", label: t("contact") },
  ];
  const homeNavLinks = [
    { href: "/services", label: t("services") },
    { href: "/portfolio", label: t("portfolio") },
    { href: "/pricing", label: t("pricing") },
    { href: "/blog", label: t("blog") },
    { href: "/about", label: t("about") },
    { href: "/schedule", label: t("schedule") },
    { href: "/contact", label: t("contact") },
  ];

  // Track pathname changes to close mobile drawer without cascading state updates
  const headerRef = useRef<HTMLElement>(null);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileMenuOpen(false);
  }

  // Scroll-aware dark/red-background detection: toggle data-dark on the header
  // when it overlaps a dark or red section on the homepage.
  useEffect(() => {
    if (!isHome) {
      headerRef.current?.removeAttribute("data-dark");
      return;
    }
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const selector = ".studio-proof, .studio-reviews, .studio-clients, .studio-booking";

    const updateDarkState = () => {
      const headerRect = headerEl.getBoundingClientRect();
      const probeY = headerRect.top + headerRect.height / 2;
      const sections = document.querySelectorAll<HTMLElement>(selector);
      let isOverDark = false;

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= probeY) {
          isOverDark = true;
          break;
        }
      }

      if (isOverDark) {
        headerEl.setAttribute("data-dark", "");
      } else {
        headerEl.removeAttribute("data-dark");
      }
    };

    let rafId = 0;
    const handleScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateDarkState();
      });
    };

    updateDarkState();
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
      headerEl.removeAttribute("data-dark");
    };
  }, [isHome]);

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
    <header ref={headerRef} className={cn(
      "sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur-md transition-all",
      isHome && "studio-nav",
    )}>
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
            className={cn("flex items-center gap-2.5 font-bold tracking-tight text-foreground transition-opacity hover:opacity-90", isHome && "studio-brand")}
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-lg bg-[#b8dc6f] font-extrabold text-[#15261f] shadow-sm"
              aria-hidden="true"
            >
              R
            </span>
            <span className={cn("text-lg font-bold tracking-tight", !isHome && "hidden min-[420px]:inline")}>{t("brand")}</span>
          </Link>

          {/* Desktop Nav */}
          {!isHome && <nav className="hidden items-center gap-4 xl:flex" aria-label="Main Navigation">
            {/* Home */}
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={cn(
                "whitespace-nowrap text-xs font-medium transition-colors hover:text-foreground",
                pathname === "/" ? "font-semibold text-primary" : "text-muted-foreground"
              )}
            >
              {t("home")}
            </Link>

            {/* Services with mega-menu */}
            <ServicesNavMenu
              label={t("services")}
              groups={serviceGroups}
              isActive={pathname === "/services" || pathname.startsWith("/services/")}
              locale={locale}
            />

            {/* Rest of nav links */}
            {otherNavLinks.slice(1).map((link) => {
              const isActive = pathname === link.href;
              const isConsultation = link.href === "/schedule";
              const animate = isConsultation && shouldAnimateConsultation;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap text-xs font-medium transition-colors hover:text-foreground",
                    isActive ? "font-semibold text-primary" : "text-muted-foreground",
                    animate && "consultation-pill-highlight text-primary"
                  )}
                >
                  {animate && (
                    <span className="consultation-soundwave" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>}
        </div>

        {isHome && (
          <nav className="studio-nav-links" aria-label={locale === "bn" ? "প্রধান নেভিগেশন" : "Main navigation"}>
            {homeNavLinks.map(({ href, label }) => {
              const isConsultation = href === "/schedule";
              const animate = isConsultation && shouldAnimateConsultation;
              return href === "/services" ? (
                <ServicesNavMenu key={href} label={label} groups={serviceGroups} isActive={pathname.startsWith("/services")} locale={locale} />
              ) : (
                <Link
                  href={href}
                  key={href}
                  className={cn(
                    animate && "consultation-pill-highlight"
                  )}
                >
                  {animate && (
                    <span className="consultation-soundwave" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!isHome && (
            <div className="hidden xl:block">
              <LanguageSwitcher />
            </div>
          )}

          {/* Signed-in: show avatar + name dropdown; signed-out: show Sign In button (using studio-get-started on home) */}
          {user ? (
            <UserMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
          ) : (
            <Link
              href={accountHref ?? "/login"}
              className={cn(
                isHome
                  ? "studio-get-started"
                  : "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground shadow-subtle transition-all hover:bg-accent hover:text-accent-foreground sm:px-3.5 sm:text-sm",
              )}
            >
              {accountHref ? t(isDashboardDestination(accountHref) ? "dashboard" : "account") : t("login")}
              {isHome && (
                <span aria-hidden="true">
                  <ArrowUpRight size={15} />
                </span>
              )}
            </Link>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted transition-colors", isHome ? "lg:hidden" : "xl:hidden")}
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
          className={cn("fixed inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-b border-border bg-background/95 px-4 py-6 shadow-xl backdrop-blur-md", isHome ? "studio-nav-drawer" : "xl:hidden")}
        >
          <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
            {/* Home */}
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-current={pathname === "/" ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                pathname === "/" ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground"
              )}
            >
              {t("home")}
            </Link>

            {/* Services accordion mega-menu for mobile */}
            <ServicesNavMenu
              label={t("services")}
              groups={serviceGroups}
              isActive={pathname === "/services" || pathname.startsWith("/services/")}
              locale={locale}
              isMobile
              onNavigate={() => setIsMobileMenuOpen(false)}
            />

            {/* Other links */}
            {otherNavLinks.slice(1).map((link) => {
              const isActive = pathname === link.href;
              const isConsultation = link.href === "/schedule";
              const animate = isConsultation && shouldAnimateConsultation;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
                    isActive ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground",
                    animate && "consultation-pill-highlight my-1 justify-start font-semibold text-foreground"
                  )}
                >
                  {animate && (
                    <span className="consultation-soundwave mr-2" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile: show user info block if signed in */}
          {user && (
            <div className="mt-4 border-t border-border pt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground overflow-hidden"
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (user.name || user.email).slice(0, 2).toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className={cn("mt-4 border-t border-border pt-4", isHome ? "flex items-center justify-between gap-3" : "")}>
            {isHome && (
              <Link href={accountHref ?? "/login"} className="px-3 text-sm font-semibold" onClick={() => setIsMobileMenuOpen(false)}>
                {accountHref ? t(isDashboardDestination(accountHref) ? "dashboard" : "account") : t("login")}
              </Link>
            )}
            {!isHome && <LanguageSwitcher />}
          </div>
        </div>
      )}
    </header>
  );
}
