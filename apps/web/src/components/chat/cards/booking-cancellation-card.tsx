"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";

type Appointment = {
  id: string;
};

type State = "loading" | "login" | "empty" | "cancelling" | "cancelled" | "syncing" | "error";

export function BookingCancellationCard({
  locale = "en",
  onCancelled,
}: {
  locale?: "en" | "bn";
  onCancelled?: () => void;
}) {
  const isBn = locale === "bn";
  const [state, setState] = useState<State>("loading");
  const onCancelledRef = useRef(onCancelled);

  useEffect(() => {
    onCancelledRef.current = onCancelled;
  }, [onCancelled]);

  useEffect(() => {
    let active = true;

    async function checkAndCancel() {
      try {
        const lookupResponse = await fetch("/api/portal/appointments/upcoming", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        const lookupPayload = await lookupResponse.json().catch(() => ({})) as {
          ok?: boolean;
          appointment?: Appointment | null;
        };
        if (!active) return;
        if (lookupResponse.status === 401) {
          setState("login");
          return;
        }
        if (!lookupResponse.ok || !lookupPayload.ok) {
          setState("error");
          return;
        }
        if (!lookupPayload.appointment) {
          setState("empty");
          return;
        }

        setState("cancelling");
        const cancelResponse = await fetch(
          `/api/portal/appointments/${encodeURIComponent(lookupPayload.appointment.id)}/cancel`,
          {
            method: "DELETE",
            headers: { accept: "application/json" },
          },
        );
        const cancelPayload = await cancelResponse.json().catch(() => ({})) as {
          ok?: boolean;
          synchronizationPending?: boolean;
        };
        if (!active) return;
        if (!cancelResponse.ok || !cancelPayload.ok) {
          setState(cancelResponse.status === 401 ? "login" : "error");
          return;
        }

        setState(cancelPayload.synchronizationPending ? "syncing" : "cancelled");
        onCancelledRef.current?.();
      } catch {
        if (active) setState("error");
      }
    }

    void checkAndCancel();
    return () => { active = false; };
  }, []);

  if (state === "loading" || state === "cancelling") {
    return <div className="flex items-center gap-2 rounded-xl border bg-card p-3"><Loader2 className="h-4 w-4 animate-spin" />{state === "loading" ? (isBn ? "অ্যাকাউন্ট ও বুকিং যাচাই হচ্ছে…" : "Checking your account and booking…") : (isBn ? "বুকিং বাতিল হচ্ছে…" : "Cancelling your booking…")}</div>;
  }

  if (state === "login") {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-3">
        <p>{isBn ? "শুধু বুকিংয়ের মালিক এটি বাতিল করতে পারবেন। আগে আপনার যাচাইকৃত অ্যাকাউন্টে সাইন ইন করুন।" : "Only the booking owner can cancel it. Please sign in to your verified account first."}</p>
        <Link href="/login?next=%2F%3FopenChat%3Dtrue" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground">
          <LogIn className="h-4 w-4" />{isBn ? "বাতিল করতে সাইন ইন করুন" : "Sign in to cancel"}
        </Link>
      </div>
    );
  }

  if (state === "empty") {
    return <div className="rounded-xl border bg-card p-3">{isBn ? "আপনার অ্যাকাউন্টে কোনো আসন্ন বুকিং পাওয়া যায়নি।" : "No upcoming booking was found for your account."}</div>;
  }

  if (state === "cancelled" || state === "syncing") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-800" role="status">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div><strong>{isBn ? "বুকিং সফলভাবে বাতিল হয়েছে" : "Booking cancelled successfully"}</strong><p className="mt-1">{state === "syncing" ? (isBn ? "Cal.com আপডেট হয়েছে; ক্লায়েন্ট পোর্টাল সিঙ্ক হচ্ছে।" : "Cal.com is updated; the client portal is finishing synchronization.") : (isBn ? "Cal.com এবং আপনার ক্লায়েন্ট পোর্টাল আপডেট হয়েছে।" : "Cal.com and your client portal have been updated.")}</p></div>
      </div>
    );
  }

  if (state === "error") {
    return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive" role="alert">{isBn ? "বুকিং বাতিল করা যায়নি। আবার চেষ্টা করুন অথবা ক্লায়েন্ট পোর্টাল ব্যবহার করুন।" : "The booking could not be cancelled. Try again or use the client portal."}</div>;
  }

  return null;
}
