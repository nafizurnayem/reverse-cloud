"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { BookingProposalCardData } from "@/lib/chat/protocol";
import { createClient } from "@/lib/supabase/browser";

interface ConfirmationCardProps {
  data: BookingProposalCardData;
  locale?: "en" | "bn";
  onConfirmed?: (proposalId: string) => void;
}

interface ConfirmedBookingInfo {
  uid: string;
  startsAt: string;
  endsAt: string;
  meetingUrl?: string;
}

export function ConfirmationCard({
  data,
  locale = "en",
  onConfirmed,
}: ConfirmationCardProps) {
  const isBn = locale === "bn";
  const [status, setStatus] = useState<string>(data.status || "open");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookingInfo, setBookingInfo] = useState<ConfirmedBookingInfo | null>(null);
  const [isPending, startTransition] = useTransition();

  // Check client session
  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: userRes } = await supabase.auth.getUser();
        if (!active) return;
        if (userRes?.user) {
          setIsAuthenticated(true);
          setUserEmail(userRes.user.email || null);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        if (active) setIsAuthenticated(false);
      }
    }
    void checkAuth();
    return () => {
      active = false;
    };
  }, []);

  function formatDateTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(isBn ? "bn-BD" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  }

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/chat/confirm-booking", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proposalId: data.proposalId }),
        });

        const json = await res.json();
        if (res.ok && json.ok) {
          setStatus("confirmed");
          if (json.booking) {
            setBookingInfo(json.booking);
          }
          onConfirmed?.(data.proposalId);
        } else if (res.status === 401 || json.code === "unauthorized") {
          setIsAuthenticated(false);
          setErrorMessage(
            isBn
              ? "সেশন শেষ হয়ে গেছে। বুকিং নিশ্চিত করতে অনুগ্রহ করে পুনরায় সাইন ইন করুন।"
              : "Authentication required. Please sign in to confirm this slot."
          );
        } else {
          setErrorMessage(
            json.message ||
              (isBn
                ? "বুকিং নিশ্চিত করা যায়নি। স্লটটির মেয়াদ উত্তীর্ণ বা অন্য কেউ বুক করে থাকতে পারে।"
                : "Unable to confirm meeting. The slot may have expired or is no longer available.")
          );
        }
      } catch {
        setErrorMessage(
          isBn
            ? "নেটওয়ার্ক ত্রুটি। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "Network error. Please try again."
        );
      }
    });
  }

  // Construct login-then-return URL with ?next=...
  const currentPath = typeof window !== "undefined" ? window.location.pathname : `/${locale}`;
  const nextPath = `${currentPath}?confirmProposal=${data.proposalId}&openChat=true`;
  const loginUrl = `/${locale}/login?next=${encodeURIComponent(nextPath)}`;

  const isConfirmed = status === "confirmed";

  return (
    <div className="w-full rounded-2xl border border-primary/30 bg-card p-4 text-xs shadow-sm transition-all space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2.5">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>{isBn ? "প্রস্তাবিত কনসালটেশন স্লট" : "Proposed Meeting Slot"}</span>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {data.durationMinutes} {isBn ? "মিনিট" : "min"}
        </span>
      </div>

      {/* Meeting Details */}
      <div className="space-y-2 bg-muted/30 rounded-xl p-3 border border-border/60">
        <div className="font-bold text-foreground text-sm">
          {data.meetingTypeName}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span>{formatDateTime(data.startsAt)}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
          <Globe className="h-3.5 w-3.5" />
          <span>{data.timezone}</span>
        </div>

        {data.intakeSummary && (
          <p className="text-[11px] text-muted-foreground border-t pt-2 mt-1 leading-relaxed">
            <span className="font-semibold text-foreground">
              {isBn ? "আলোচনার বিষয়: " : "Discussion Scope: "}
            </span>
            {data.intakeSummary}
          </p>
        )}
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-[11px] font-medium">
          {errorMessage}
        </div>
      )}

      {/* Actions based on Auth & Status */}
      {isConfirmed ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-[11px] space-y-1">
            <span className="font-bold block">
              {isBn ? "মিটিং নিশ্চিত করা হয়েছে!" : "Meeting Confirmed!"}
            </span>
            <span className="text-[10px] opacity-90 block">
              {isBn
                ? "ক্যালেন্ডার ইনভাইট এবং গুগল মিট লিংক আপনার ইমেইলে পাঠানো হয়েছে।"
                : "Calendar invite & Google Meet link sent to your email."}
            </span>
            {bookingInfo?.meetingUrl && (
              <a
                href={bookingInfo.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 underline mt-1"
              >
                <span>{isBn ? "মিটিং লিংকে যোগ দিন →" : "Join Meeting Link →"}</span>
              </a>
            )}
          </div>
        </div>
      ) : isAuthenticated ? (
        /* Signed-in Human Confirms */
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              {isBn
                ? `প্রমাণীকৃত ইউজার (${userEmail || "Signed in"}) হিসেবে বুকিং`
                : `Booking as authenticated user (${userEmail || "Signed in"})`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{isBn ? "নিশ্চিত করা হচ্ছে..." : "Confirming..."}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{isBn ? "মিটিং নিশ্চিত করুন" : "Confirm Consultation"}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Login-then-Return CTA */
        <div className="space-y-2.5 pt-1">
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              {isBn
                ? "বুকিং নিশ্চিত করতে ও স্প্যাম রোধে সাইন-ইন আবশ্যক। সাইন-ইনের পর স্বয়ংক্রিয়ভাবে এখানে ফিরে আসবেন।"
                : "A signed-in human must confirm this slot. You will return right back after sign in."}
            </span>
          </div>

          <a
            href={loginUrl}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>{isBn ? "লগইন করে নিশ্চিত করুন" : "Sign In to Confirm"}</span>
          </a>
        </div>
      )}
    </div>
  );
}
