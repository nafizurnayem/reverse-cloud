"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarX2, CheckCircle2, Loader2, LogIn, XCircle } from "lucide-react";

type Appointment = {
  id: string;
  startsAt: string;
  timeZone: string;
  meetingTypeNameEn: string;
  meetingTypeNameBn?: string | null;
};

type State = "loading" | "login" | "empty" | "ready" | "confirm" | "cancelling" | "cancelled" | "syncing" | "error";

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

export function BookingCancellationCard({
  locale = "en",
  onCancelled,
}: {
  locale?: "en" | "bn";
  onCancelled?: () => void;
}) {
  const isBn = locale === "bn";
  const [state, setState] = useState<State>("loading");
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/portal/appointments/upcoming", {
      headers: { accept: "application/json" },
      cache: "no-store",
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({})) as {
        ok?: boolean;
        appointment?: Appointment | null;
      };
      if (!active) return;
      if (response.status === 401) setState("login");
      else if (!response.ok || !payload.ok) setState("error");
      else if (!payload.appointment) setState("empty");
      else {
        setAppointment(payload.appointment);
        setState("ready");
      }
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, []);

  async function cancel() {
    if (!appointment) return;
    setState("cancelling");
    try {
      const response = await fetch(`/api/portal/appointments/${encodeURIComponent(appointment.id)}/cancel`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; synchronizationPending?: boolean };
      if (!response.ok || !payload.ok) {
        setState(response.status === 401 ? "login" : "error");
        return;
      }
      setState(payload.synchronizationPending ? "syncing" : "cancelled");
      onCancelled?.();
    } catch {
      setState("error");
    }
  }

  if (state === "loading") {
    return <div className="flex items-center gap-2 rounded-xl border bg-card p-3"><Loader2 className="h-4 w-4 animate-spin" />{isBn ? "বুকিং যাচাই হচ্ছে…" : "Checking your booking…"}</div>;
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

  if (!appointment) return null;
  const meetingName = isBn
    ? appointment.meetingTypeNameBn || appointment.meetingTypeNameEn
    : appointment.meetingTypeNameEn;
  const startsAt = new Intl.DateTimeFormat(isBn ? "bn-BD" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: validTimeZone(appointment.timeZone),
  }).format(new Date(appointment.startsAt));

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex items-start gap-2"><CalendarX2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><strong>{meetingName}</strong><p className="text-muted-foreground">{startsAt}</p></div></div>
      {state === "confirm" ? (
        <div className="space-y-2 rounded-lg bg-destructive/5 p-2">
          <p className="font-semibold">{isBn ? "আপনি কি এই বুকিং বাতিল করতে নিশ্চিত?" : "Are you sure you want to cancel this booking?"}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setState("ready")} className="rounded-lg border px-3 py-2 font-semibold">{isBn ? "রাখুন" : "Keep booking"}</button>
            <button type="button" onClick={() => void cancel()} className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3 py-2 font-semibold text-destructive-foreground"><XCircle className="h-4 w-4" />{isBn ? "হ্যাঁ, বাতিল করুন" : "Yes, cancel"}</button>
          </div>
        </div>
      ) : state === "cancelling" ? (
        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{isBn ? "বাতিল হচ্ছে…" : "Cancelling…"}</div>
      ) : (
        <button type="button" onClick={() => setState("confirm")} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 font-semibold text-destructive-foreground"><XCircle className="h-4 w-4" />{isBn ? "বুকিং বাতিল করুন" : "Cancel booking"}</button>
      )}
    </div>
  );
}
