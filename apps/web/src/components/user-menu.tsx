"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { LogOut, User } from "lucide-react";
import { signOut } from "@/app/[locale]/(auth)/actions";
import { Link } from "@/i18n/navigation";

type Props = {
  name: string;
  email: string;
  avatarUrl?: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const HINT_KEY = "um_portal_hinted";
// Total auto-sequence: 400ms delay + 3000ms open + 300ms close animation = ~3.7s

export function UserMenu({ name, email, avatarUrl }: Props) {
  const locale = useLocale();
  const isBn = locale === "bn";
  const [open, setOpen] = useState(false);
  const [portalHint, setPortalHint] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  // Track whether the auto-sequence is in flight so manual interactions cancel it
  const hintSequenceRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isAutoSequenceRef = useRef(false);

  // ── Auto-hint on first visit per session ──────────────────────────────────
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HINT_KEY)) return;
    } catch {
      return; // sessionStorage blocked (private browsing, etc.)
    }

    isAutoSequenceRef.current = true;

    // Slight delay so the page settles before we open the menu
    const t1 = setTimeout(() => {
      setOpen(true);
      setPortalHint(true);

      // Close after 3 seconds
      const t2 = setTimeout(() => {
        setOpen(false);
        setPortalHint(false);
        isAutoSequenceRef.current = false;
        try { sessionStorage.setItem(HINT_KEY, "1"); } catch { /* ignore */ }
      }, 3000);

      hintSequenceRef.current.push(t2);
    }, 400);

    hintSequenceRef.current.push(t1);

    return () => {
      hintSequenceRef.current.forEach(clearTimeout);
      hintSequenceRef.current = [];
    };
  }, []);

  // ── Close on click-outside / Escape ──────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPortalHint(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setPortalHint(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function cancelAutoSequence() {
    if (isAutoSequenceRef.current) {
      hintSequenceRef.current.forEach(clearTimeout);
      hintSequenceRef.current = [];
      isAutoSequenceRef.current = false;
      setPortalHint(false);
      try { sessionStorage.setItem(HINT_KEY, "1"); } catch { /* ignore */ }
    }
  }

  function handleToggle() {
    cancelAutoSequence();
    setOpen((prev) => !prev);
  }

  function handleSignOut() {
    cancelAutoSequence();
    startTransition(() => signOut(locale));
  }

  const displayInitials = initials(name || email);

  return (
    <div ref={ref} className="relative flex shrink-0 items-center" id="user-menu-root">
      {/* Trigger */}
      <button
        type="button"
        id="user-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="user-menu-dropdown"
        onClick={handleToggle}
        className="group flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-3 py-1 text-xs font-medium text-foreground shadow-subtle transition-all hover:bg-muted hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Avatar circle */}
        <span
          aria-hidden="true"
          className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-sm ring-2 ring-primary/20"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            displayInitials
          )}
        </span>
        {/* Name — hidden on tiny screens */}
        <span className="hidden max-w-[9rem] truncate sm:inline">{name || email}</span>
        {/* Chevron */}
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`hidden shrink-0 text-muted-foreground transition-transform duration-200 sm:block ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id="user-menu-dropdown"
          role="menu"
          aria-label={isBn ? "অ্যাকাউন্ট মেনু" : "Account menu"}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Identity block */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <span
              aria-hidden="true"
              className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground shadow ring-2 ring-primary/20"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                displayInitials
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground leading-tight">{name}</p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">{email}</p>
            </div>
          </div>

          {/* Profile link */}
          <div className="px-2 py-1.5">
            <Link
              href="/portal"
              role="menuitem"
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted${
                portalHint ? " user-menu-portal-hint" : ""
              }`}
              onClick={() => { cancelAutoSequence(); setOpen(false); }}
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{isBn ? "আমার পোর্টাল" : "My Portal"}</span>
              {portalHint && (
                <span
                  aria-hidden="true"
                  className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-primary animate-pulse"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="shrink-0">
                    <circle cx="4" cy="4" r="4" />
                  </svg>
                  {isBn ? "খুলুন" : "Open"}
                </span>
              )}
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-border px-2 py-1.5">
            <button
              type="button"
              role="menuitem"
              id="user-menu-sign-out"
              disabled={isPending}
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isBn ? "সাইন আউট" : "Sign out"}</span>
              {isPending && (
                <svg
                  aria-hidden="true"
                  className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
