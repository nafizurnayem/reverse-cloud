"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ServiceGroupItem = {
  slug: string;
  name: string;
  icon?: string | null;
};

export type ServiceGroup = {
  id: string;
  slug: string;
  name: string;
  services: ServiceGroupItem[];
};

interface ServicesNavMenuProps {
  label: string;
  groups: ServiceGroup[];
  isActive: boolean;
  locale: string;
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function ServicesNavMenu({
  label,
  groups,
  isActive,
  locale: _locale,
  isMobile = false,
  onNavigate,
}: ServicesNavMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  if (isMobile) {
    // Mobile: accordion-style toggle
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
            isActive ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground"
          )}
        >
          <span>{label}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
        </button>
        {open && groups.length > 0 && (
          <div className="mt-1 ml-3 space-y-1.5 border-l border-border pl-3">
            <Link
              href="/services"
              onClick={onNavigate}
              className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              {_locale === "bn" ? "সব সার্ভিস দেখুন" : "View All Services →"}
            </Link>
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/services?group=${group.slug}`}
                onClick={onNavigate}
                className="block rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {group.name}
              </Link>
            ))}
          </div>
        )}
        {/* No groups: just show Services link directly */}
        {open && groups.length === 0 && (
          <div className="mt-1 ml-3 border-l border-border pl-3">
            <Link href="/services" onClick={onNavigate} className="block rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {_locale === "bn" ? "সব সার্ভিস" : "All Services"}
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Desktop: hover mega-menu
  if (groups.length === 0) {
    // No groups → plain link, no mega-menu
    return (
      <Link
        href="/services"
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "whitespace-nowrap text-xs font-medium transition-colors hover:text-foreground",
          isActive ? "font-semibold text-primary" : "text-muted-foreground"
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      {/* Services label — clicking navigates to /services */}
      <Link
        href="/services"
        aria-current={isActive ? "page" : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium transition-colors hover:text-foreground",
          isActive ? "font-semibold text-primary" : "text-muted-foreground"
        )}
        onClick={() => setOpen(false)}
      >
        {label}
        <ChevronDown
          className={cn(
            "ml-0.5 h-3 w-3 transition-transform duration-200 opacity-70",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </Link>

      {/* Services sub-bar — same width & height as header, opens on hover */}
      {open && (
        <div
          role="navigation"
          aria-label="Services menu"
          className="fixed left-0 right-0 top-16 z-50 h-16 border-b border-border/80 bg-background/95 shadow-md backdrop-blur-md transition-all flex items-center"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
            {/* Centered, evenly spaced group names with generous clickable hit areas */}
            <nav className="flex flex-1 items-center justify-center gap-3 sm:gap-6 md:gap-8 overflow-x-auto py-1 scrollbar-none">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/services?group=${group.slug}`}
                  onClick={() => setOpen(false)}
                  className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border/70 bg-card/90 px-4 py-2 text-xs sm:text-sm font-semibold text-foreground shadow-xs transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70 transition-colors group-hover:bg-primary-foreground" />
                  <span>{group.name}</span>
                </Link>
              ))}
            </nav>

            {/* Link to view all services */}
            <Link
              href="/services"
              onClick={() => setOpen(false)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs sm:text-sm font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground shadow-xs"
            >
              <span>{_locale === "bn" ? "সব সার্ভিস" : "All Services"}</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
