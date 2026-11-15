"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Calendar, CheckCircle2, Clock, Loader2, Mail, Phone, ShieldCheck, User } from "lucide-react";
import type { BookingSchedulerCardData } from "@/lib/chat/protocol";
import { bookingCountryCodes, normalizePhoneNumber } from "@/lib/phone";
import { scheduleDayRange, upcomingScheduleDays } from "@/lib/schedule-time";
import { createClient } from "@/lib/supabase/browser";

interface BookingSchedulerCardProps {
  data: BookingSchedulerCardData;
  locale?: "en" | "bn";
  turnstileSiteKey?: string;
}

interface SlotItem {
  start: string;
  end: string;
}

interface BookingInfo {
  startsAt: string;
  endsAt: string;
  meetingUrl?: string;
}

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    language: "en" | "bn";
    size: "flexible";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

function turnstileApi() {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

function requestedTime(value: string) {
  const match = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(value);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "pm") hour += 12;
  return { hour, minute: Number(match[2] ?? 0) };
}

function slotLocalTime(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { hour: Number(values.hour), minute: Number(values.minute) };
}

export function BookingSchedulerCard({
  data,
  locale = "en",
  turnstileSiteKey = "",
}: BookingSchedulerCardProps) {
  const isBn = locale === "bn";
  const [timeZone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });
  const days = useMemo(
    () => upcomingScheduleDays(new Date(), timeZone, isBn ? "bn-BD" : "en-US"),
    [isBn, timeZone],
  );
  const requestedDate = useMemo(() => {
    const query = (data.requestedText ?? "").toLowerCase();
    return days.find((day) => {
      const number = Number(day.iso.slice(-2));
      const englishMonth = new Date(`${day.iso}T12:00:00Z`)
        .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
        .toLowerCase();
      const numberMatch = new RegExp(`\\b${number}(?:st|nd|rd|th)?\\b`, "i").test(query);
      const monthMatch = query.includes(englishMonth);
      return numberMatch && monthMatch;
    })?.iso ?? days[0]?.iso ?? "";
  }, [data.requestedText, days]);

  const [selectedDate, setSelectedDate] = useState(requestedDate);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("BD");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const siteKey = turnstileSiteKey;
  const meetingType = data.meetingTypeKey ?? "discovery_call";
  const countryCode = bookingCountryCodes.find((item) => item.country === selectedCountry)?.code ?? "+880";

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: result } = await supabase.auth.getUser();
        if (!active) return;
        const user = result.user;
        setIsAuthenticated(Boolean(user));
        if (user) {
          const metadata = user.user_metadata ?? {};
          const accountName = typeof metadata.full_name === "string"
            ? metadata.full_name
            : typeof metadata.name === "string" ? metadata.name : "";
          setEmail(user.email ?? "");
          setName(accountName || user.email?.split("@")[0] || "Reverse Cloud Client");
        }
      } catch {
        if (active) setIsAuthenticated(false);
      }
    }
    void checkAuth();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    async function loadSlots() {
      setLoadingSlots(true);
      setAvailabilityError(false);
      try {
        const range = scheduleDayRange(selectedDate, timeZone);
        const params = new URLSearchParams({
          meetingType,
          start: range.start,
          end: range.end,
          timeZone,
        });
        const response = await fetch(`/api/schedule/slots?${params}`);
        const payload = await response.json();
        if (!active) return;
        if (!response.ok || !payload.ok || !Array.isArray(payload.slots)) throw new Error("availability");
        const available = payload.slots as SlotItem[];
        setSlots(available);
        const preferred = requestedTime(data.requestedText ?? "");
        setSelectedSlot((current) => {
          if (current && available.some((slot) => slot.start === current.start)) return current;
          if (!preferred) return null;
          return available.find((slot) => {
            const local = slotLocalTime(slot.start, timeZone);
            return local.hour === preferred.hour && local.minute === preferred.minute;
          }) ?? null;
        });
      } catch {
        if (active) {
          setSlots([]);
          setSelectedSlot(null);
          setAvailabilityError(true);
        }
      } finally {
        if (active) setLoadingSlots(false);
      }
    }
    void loadSlots();
    return () => { active = false; };
  }, [data.requestedText, meetingType, selectedDate, timeZone]);

  useEffect(() => {
    if (isAuthenticated !== false || !siteKey || !turnstileScriptReady) return;
    const api = turnstileApi();
    const container = turnstileContainerRef.current;
    if (!api || !container || turnstileWidgetIdRef.current) return;

    const widgetId = api.render(container, {
      sitekey: siteKey,
      action: "schedule_booking",
      language: locale,
      size: "flexible",
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken(""),
    });
    turnstileWidgetIdRef.current = widgetId;

    return () => {
      api.remove(widgetId);
      turnstileWidgetIdRef.current = null;
      setTurnstileToken("");
    };
  }, [isAuthenticated, locale, siteKey, turnstileScriptReady]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString(isBn ? "bn-BD" : "en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!selectedSlot) {
      setError(isBn ? "একটি উপলভ্য সময় নির্বাচন করুন।" : "Select an available time first.");
      return;
    }
    if (!isAuthenticated) {
      if (name.trim().length < 2) {
        setError(isBn ? "আপনার নাম লিখুন।" : "Enter your name.");
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        setError(isBn ? "সঠিক ইমেইল লিখুন।" : "Enter a valid email address.");
        return;
      }
      if (!normalizePhoneNumber(countryCode, phone)) {
        setError(isBn ? "সঠিক ফোন নম্বর লিখুন।" : "Enter a valid phone number.");
        return;
      }
    }
    if (!isAuthenticated && !turnstileToken) {
      setError(isBn ? "সিকিউরিটি যাচাই সম্পন্ন করুন।" : "Complete the security verification first.");
      return;
    }
    const normalizedPhone = isAuthenticated ? null : normalizePhoneNumber(countryCode, phone);
    startTransition(async () => {
      try {
        const response = await fetch("/api/schedule/book", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            meetingType,
            start: selectedSlot.start,
            end: selectedSlot.end,
            timeZone,
            name: name.trim(),
            email: email.trim(),
            phone: normalizedPhone,
            source: "chat",
            company: null,
            notes: "Booked through the website chatbot",
            locale,
            turnstileToken,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          const widgetId = turnstileWidgetIdRef.current;
          if (widgetId) turnstileApi()?.reset(widgetId);
          setTurnstileToken("");
          if (payload.code === "slot_unavailable") {
            setSelectedSlot(null);
            setError(isBn ? "সময়টি আর উপলভ্য নেই। অন্য সময় বেছে নিন।" : "That slot is no longer available. Choose another time.");
          } else if (payload.code === "active_booking_exists") {
            setError(isBn ? "এই ইমেইলে ইতিমধ্যে একটি আসন্ন বুকিং রয়েছে।" : "This email already has an upcoming booking.");
          } else if (payload.code === "turnstile_required") {
            setError(isBn ? "সিকিউরিটি যাচাই সম্পন্ন করুন।" : "Complete the security verification first.");
          } else if (payload.code === "turnstile_failed") {
            setError(isBn ? "সিকিউরিটি যাচাই ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" : "Security verification failed. Please try again.");
          } else if (payload.code === "protection_unavailable") {
            setError(isBn ? "সিকিউরিটি সেবা সাময়িকভাবে অনুপলব্ধ।" : "Security verification is temporarily unavailable.");
          } else if (payload.code === "invalid_phone") {
            setError(isBn ? "দেশের কোডসহ সঠিক ফোন নম্বর লিখুন।" : "Enter a valid phone number with its country code.");
          } else {
            setError(isBn ? "বুকিং সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" : "Booking could not be completed. Please try again.");
          }
          return;
        }
        setBooking(payload.booking);
      } catch {
        setError(isBn ? "নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।" : "Network error. Please try again.");
      }
    });
  }

  if (booking) {
    return (
      <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-800">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1 text-[11px]">
            <strong className="block">{isBn ? "মিটিং বুক হয়েছে!" : "Meeting booked!"}</strong>
            <span className="block">{new Date(booking.startsAt).toLocaleString(isBn ? "bn-BD" : "en-US", { timeZone, dateStyle: "medium", timeStyle: "short" })}</span>
            <span className="block">{isBn ? "ক্যালেন্ডার ইনভাইট ইমেইলে পাঠানো হয়েছে।" : "A calendar invitation has been sent by email."}</span>
            {booking.meetingUrl && <a className="font-semibold underline" href={booking.meetingUrl} target="_blank" rel="noreferrer">{isBn ? "মিটিং লিংক খুলুন" : "Open meeting link"}</a>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-xl border border-primary/30 bg-card p-3 text-[11px] shadow-sm">
      <div className="flex items-center gap-2 font-bold text-foreground">
        <Calendar className="h-4 w-4 text-primary" />
        <span>{isBn ? "লাইভ মিটিং বুকিং" : "Live meeting booking"}</span>
      </div>

      <label className="block space-y-1">
        <span className="font-semibold">{isBn ? "তারিখ" : "Date"}</span>
        <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-full rounded-lg border bg-background px-2 py-2 text-xs">
          {days.map((day) => <option key={day.iso} value={day.iso}>{day.dayName}, {day.dayNumber} {day.monthName}</option>)}
        </select>
      </label>

      <div className="space-y-1.5">
        <span className="flex items-center gap-1 font-semibold"><Clock className="h-3.5 w-3.5" />{isBn ? "উপলভ্য সময়" : "Available times"}</span>
        {loadingSlots ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted p-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{isBn ? "সময় খোঁজা হচ্ছে..." : "Loading live slots..."}</div>
        ) : availabilityError ? (
          <div className="rounded-lg bg-destructive/10 p-2 text-destructive">{isBn ? "লাইভ সময় লোড করা যায়নি।" : "Live availability could not be loaded."}</div>
        ) : slots.length === 0 ? (
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">{isBn ? "এই দিনে কোনো সময় খালি নেই।" : "No slots are available on this date."}</div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {slots.map((slot) => (
              <button key={slot.start} type="button" onClick={() => setSelectedSlot(slot)} className={`rounded-lg border px-2 py-1.5 font-semibold ${selectedSlot?.start === slot.start ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary"}`}>
                {formatTime(slot.start)}
              </button>
            ))}
          </div>
        )}
      </div>

      {isAuthenticated === null ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{isBn ? "অ্যাকাউন্ট যাচাই হচ্ছে..." : "Checking your account..."}</div>
      ) : isAuthenticated ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-emerald-800"><ShieldCheck className="h-4 w-4" /><span>{isBn ? `${email} হিসেবে বুকিং` : `Booking as ${email}`}</span></div>
      ) : (
        <div className="space-y-2 border-t pt-3">
          <p className="font-semibold">{isBn ? "বুকিংয়ের জন্য আপনার তথ্য দিন" : "Enter your details to book"}</p>
          <label className="flex items-center gap-2 rounded-lg border bg-background px-2"><User className="h-3.5 w-3.5 text-muted-foreground" /><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder={isBn ? "পূর্ণ নাম" : "Full name"} className="min-w-0 flex-1 bg-transparent py-2 outline-none" /></label>
          <label className="flex items-center gap-2 rounded-lg border bg-background px-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={isBn ? "ইমেইল" : "Email address"} className="min-w-0 flex-1 bg-transparent py-2 outline-none" /></label>
          <label className="flex items-center gap-2 rounded-lg border bg-background px-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <select
              aria-label={isBn ? "দেশের ফোন কোড" : "Country calling code"}
              value={selectedCountry}
              onChange={(event) => setSelectedCountry(event.target.value)}
              className="max-w-[7.5rem] bg-transparent py-2 text-[11px] outline-none"
            >
              {bookingCountryCodes.map((item) => (
                <option key={item.country} value={item.country}>
                  {item.country} {item.code} — {item.label}
                </option>
              ))}
            </select>
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={isBn ? "যেমন 017XXXXXXXX" : "e.g. 017XXXXXXXX"}
              className="min-w-0 flex-1 bg-transparent py-2 outline-none"
            />
          </label>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onReady={() => setTurnstileScriptReady(true)}
          />
          {siteKey ? <div className="chat-turnstile"><div ref={turnstileContainerRef} /></div> : <div className="text-destructive">{isBn ? "সিকিউরিটি যাচাই কনফিগার করা নেই।" : "Security verification is not configured."}</div>}
        </div>
      )}

      {error && <div role="alert" className="rounded-lg bg-destructive/10 p-2 text-destructive">{error}</div>}
      <button type="submit" disabled={isPending || isAuthenticated === null || !selectedSlot || (!isAuthenticated && (!siteKey || !turnstileToken))} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 font-bold text-primary-foreground disabled:opacity-50">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {isPending ? (isBn ? "বুক করা হচ্ছে..." : "Booking...") : (isBn ? "বুকিং নিশ্চিত করুন" : "Confirm booking")}
      </button>
    </form>
  );
}
