"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight, ChevronDown } from "lucide-react";
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

  return (
    <div
      ref={containerRef}
      className="services-nav-container relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onFocus={() => { cancelClose(); setOpen(true); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.stopPropagation(); } }}
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
            "ml-1 h-4 w-4 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </Link>

      {/* Services sub-bar — same width & height as header, opens on hover */}
      {open && (
        <div role="navigation" aria-label={_locale === "bn" ? "সার্ভিস গ্রুপ" : "Service groups"}
          className="services-nav-panel absolute left-0 top-full z-50 w-[min(58rem,80vw)] pt-3 animate-in fade-in slide-in-from-top-2 duration-200"
          onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <div className="services-nav-surface overflow-hidden rounded-xl border border-border/70 p-4 shadow-xl backdrop-blur-xl">
            <nav className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(groups.length, 1), 4)}, minmax(0, 1fr))` }}>
              {groups.length === 0 && <p className="p-4 text-sm text-muted-foreground">{_locale === "bn" ? "সার্ভিস গ্রুপ লোড করা যায়নি।" : "Service groups are unavailable."}</p>}
              {groups.map((group) => (
                <Link key={group.id} href={`/services?group=${group.slug}`} onClick={() => setOpen(false)} className="group flex min-h-16 items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-4 text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/60 hover:shadow-sm">
                  <span>{group.name}</span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center border border-border bg-background transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true"><ArrowUpRight size={17} /></span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
