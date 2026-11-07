"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { LogOut, User } from "lucide-react";
import { signOut } from "@/app/[locale]/(auth)/actions";

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

export function UserMenu({ name, email, avatarUrl }: Props) {
  const locale = useLocale();
  const isBn = locale === "bn";
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
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

  function handleSignOut() {
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
        onClick={() => setOpen((prev) => !prev)}
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
            <a
              href={`/${locale}/portal`}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{isBn ? "আমার পোর্টাল" : "My Portal"}</span>
            </a>
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
