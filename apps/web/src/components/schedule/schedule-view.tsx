"use client";

import { useEffect, useState, useTransition } from "react";
import Script from "next/script";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  Mail,
  Send,
  Sparkles,
  User,
  UserCheck,
} from "lucide-react";
import type { ScheduleMeetingType, SchedulePrefill } from "@/lib/schedule-server";
import { scheduleDayRange, upcomingScheduleDays } from "@/lib/schedule-time";
import { Badge } from "@/components/ui/badge";

interface ScheduleViewProps {
  meetingTypes: ScheduleMeetingType[];
  prefill: SchedulePrefill;
  locale: string;
  siteKey: string;
}

interface SlotItem {
  start: string;
  end: string;
}

interface BookingConfirmedDetails {
  uid: string;
  startsAt: string;
  endsAt: string;
  meetingUrl?: string;
}

export function ScheduleView({ meetingTypes, prefill, locale, siteKey }: ScheduleViewProps) {
  const isBn = locale === "bn";

  const [selectedMeetingType, setSelectedMeetingType] = useState<string>(
    meetingTypes[0]?.key || "discovery_call"
  );
  const [timeZone, setTimeZone] = useState<string>(() => {
    try {
      return prefill.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    upcomingScheduleDays(new Date(), timeZone, "en-US", 1)[0].iso
  );

  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [availabilityError, setAvailabilityError] = useState<boolean>(false);
  const [availabilityRetry, setAvailabilityRetry] = useState<number>(0);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  // Form Fields
  const [name, setName] = useState<string>(prefill.name);
  const [email, setEmail] = useState<string>(prefill.email);
  const [company, setCompany] = useState<string>(prefill.company);
  const [notes, setNotes] = useState<string>("");

  const [bookingConfirmed, setBookingConfirmed] = useState<boolean>(false);
  const [confirmedDetails, setConfirmedDetails] = useState<BookingConfirmedDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  // Keep each card's visible date and submitted date key in the selected timezone.
  const upcomingDays = upcomingScheduleDays(
    new Date(),
    timeZone,
    isBn ? "bn-BD" : "en-US"
  );

  // Fetch live availability from Cal.com through the scheduling API.
  useEffect(() => {
    let active = true;

    async function fetchSlots() {
      try {
        const { start, end } = scheduleDayRange(selectedDate, timeZone);
        const res = await fetch(
          `/api/schedule/slots?meetingType=${encodeURIComponent(
            selectedMeetingType
          )}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&timeZone=${encodeURIComponent(
            timeZone
          )}`
        );
        const json = await res.json();
        if (!active) return;
        if (res.ok && json.ok && Array.isArray(json.slots)) {
          setSlots(json.slots);
          setSelectedSlot((current) =>
            current && json.slots.some((slot: SlotItem) => slot.start === current.start && slot.end === current.end)
              ? current
              : null
          );
          setAvailabilityError(false);
        } else {
          setSlots([]);
          setAvailabilityError(true);
        }
      } catch {
        if (!active) return;
        setSlots([]);
        setAvailabilityError(true);
      } finally {
        if (active) setLoadingSlots(false);
      }
    }

    const timer = setTimeout(() => {
      if (active) {
        setLoadingSlots(true);
        setAvailabilityError(false);
        void fetchSlots();
      }
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedMeetingType, selectedDate, timeZone, availabilityRetry]);

  useEffect(() => {
    const refresh = () => setAvailabilityRetry((value) => value + 1);
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg(isBn ? "অনুগ্রহ করে আপনার নাম লিখুন।" : "Please enter your name.");
      return;
    }
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErrorMsg(isBn ? "অনুগ্রহ করে সঠিক ইমেইল লিখুন।" : "Please enter a valid work email.");
      return;
    }
    if (!selectedSlot) {
      setErrorMsg(isBn ? "অনুগ্রহ করে একটি সময় নির্বাচন করুন।" : "Please select an available time slot.");
      return;
    }

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const turnstileToken =
      (formData.get("cf-turnstile-response") as string) ||
      (typeof window !== "undefined" && (window as unknown as { turnstileToken?: string }).turnstileToken) ||
      "";

    startSubmit(async () => {
      try {
        const res = await fetch("/api/schedule/book", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            meetingType: selectedMeetingType,
            start: selectedSlot.start,
            end: selectedSlot.end,
            timeZone,
            name: name.trim(),
            email: email.trim(),
            company: company.trim() || null,
            notes: notes.trim() || null,
            locale: isBn ? "bn" : "en",
            turnstileToken,
          }),
        });

        const data = await res.json();
        if (res.ok && data.ok) {
          if (data.booking) {
            setConfirmedDetails(data.booking);
          }
          setBookingConfirmed(true);
        } else {
          window.turnstile?.reset();
          if (data.code === "slot_unavailable") {
            setSelectedSlot(null);
            setAvailabilityRetry((value) => value + 1);
            setErrorMsg(
              isBn
                ? "এই সময়টি আর উপলব্ধ নেই। অনুগ্রহ করে অন্য একটি সময় নির্বাচন করুন।"
                : "This slot is no longer available. Please select another time."
            );
          } else if (data.code === "active_booking_exists") {
            const availableAfter = typeof data.availableAfter === "string"
              ? new Date(data.availableAfter).toLocaleString(isBn ? "bn-BD" : "en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone,
                })
              : null;
            setErrorMsg(
              isBn
                ? `এই ইমেইলে ইতিমধ্যে একটি সক্রিয় বুকিং রয়েছে। বর্তমান মিটিং শেষ হওয়ার পর${availableAfter ? ` (${availableAfter})` : ""} আপনি আবার বুক করতে পারবেন।`
                : `This email already has an active booking. You can book another meeting after it ends${availableAfter ? ` (${availableAfter})` : ""}.`
            );
          } else if (data.code === "turnstile_failed") {
            setErrorMsg(
              isBn
                ? "সিকিউরিটি ভেরিফিকেশন ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
                : "Security verification failed. Please try again."
            );
          } else {
            setErrorMsg(
              data.message ||
                (isBn
                  ? "বুকিং সম্পন্ন করা যায়নি। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
                  : "Unable to complete booking. Please try again later.")
            );
          }
        }
      } catch {
        window.turnstile?.reset();
        setErrorMsg(
          isBn
            ? "নেটওয়ার্ক ত্রুটি। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "Network error occurred. Please try again."
        );
      }
    });
  }

  function formatSlotTime(slotIso: string) {
    try {
      return new Date(slotIso).toLocaleTimeString(isBn ? "bn-BD" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return slotIso.slice(11, 16);
    }
  }

  const currentMeeting = meetingTypes.find((m) => m.key === selectedMeetingType) || meetingTypes[0];

  return (
    <div className="space-y-10">
      {/* Signed-in Prefill Status Banner */}
      {prefill.isSignedIn ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-600 dark:text-emerald-400 shadow-sm">
          <UserCheck className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">
              {isBn ? "সাইন-ইন অ্যাকাউন্টের সাথে সংযুক্ত: " : "Signed-in Account Connected: "}
            </span>
            <span>
              {prefill.name} ({prefill.email})
            </span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              {isBn
                ? "আপনার যোগাযোগের তথ্য স্বয়ংক্রিয়ভাবে নিচে পূরণ করা হয়েছে।"
                : "Your profile details have been automatically pre-filled below."}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 text-xs text-muted-foreground shadow-sm">
          <div className="flex items-center gap-2.5">
            <User className="h-4 w-4 text-primary" />
            <span>
              {isBn
                ? "পূর্বে নিবন্ধিত ক্লায়েন্ট? দ্রুত বুকিংয়ের জন্য সাইন ইন করুন।"
                : "Existing client or portal user? Sign in for instant prefill."}
            </span>
          </div>
          <a
            href={`/${locale}/login?next=/${locale}/schedule`}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
          >
            <span>{isBn ? "সাইন ইন করুন →" : "Sign In →"}</span>
          </a>
        </div>
      )}

      {/* Confirmation View */}
      {bookingConfirmed ? (
        <div className="rounded-3xl border border-emerald-500/30 bg-card p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xl space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {isBn ? "বুকিং নিশ্চিত হয়েছে" : "Meeting Scheduled"}
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {isBn ? "আপনার মিটিং অনুরোধ সফল হয়েছে!" : "Your Consultation is Booked!"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {isBn
                ? `আমরা ${email} ঠিকানায় মিটিং লিঙ্ক এবং গুগল ক্যালেন্ডার ইনভাইট পাঠিয়েছি।`
                : `A calendar invitation and Google Meet link have been sent to ${email}.`}
            </p>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-5 text-left text-xs space-y-2.5 font-mono">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{isBn ? "মিটিং ধরন:" : "Meeting Type:"}</span>
              <span className="font-bold text-foreground">{currentMeeting?.name}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">{isBn ? "তারিখ ও সময়:" : "Date & Time:"}</span>
              <span className="font-bold text-foreground">
                {selectedDate} ({selectedSlot ? formatSlotTime(selectedSlot.start) : ""})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isBn ? "সময় অঞ্চল:" : "Timezone:"}</span>
              <span className="font-bold text-foreground">{timeZone}</span>
            </div>
          </div>

          {confirmedDetails?.meetingUrl && (
            <div className="pt-1">
              <a
                href={confirmedDetails.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
              >
                <span>{isBn ? "মিটিং লিংকে যোগ দিন →" : "Join Meeting Link →"}</span>
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setBookingConfirmed(false);
              setSelectedSlot(null);
            }}
            className="inline-flex items-center justify-center rounded-xl border bg-background px-5 py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
          >
            {isBn ? "অন্য একটি সময় নির্ধারণ করুন" : "Schedule Another Call"}
          </button>
        </div>
      ) : (
        /* Booking Interface */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Meeting Selection & Calendar */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Meeting Type Cards */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isBn ? "১. মিটিং ধরন নির্বাচন করুন" : "1. Select Meeting Type"}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {meetingTypes.map((mt) => {
                  const isSelected = selectedMeetingType === mt.key;
                  return (
                    <button
                      key={mt.key}
                      type="button"
                      onClick={() => {
                        setSelectedMeetingType(mt.key);
                        setSelectedSlot(null);
                      }}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                          : "border-border/70 bg-card hover:border-primary/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                            <Clock className="h-3 w-3" />
                            <span>
                              {mt.durationMinutes} {isBn ? "মিনিট" : "min"}
                            </span>
                          </span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                        <h3 className="text-sm font-bold text-foreground">{mt.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {mt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Date Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isBn ? "২. সুবিধাজনক দিন বেছে নিন" : "2. Choose Available Day"}
                </label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-xl border border-border/70">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <select
                    value={timeZone}
                    onChange={(e) => {
                      const nextTimeZone = e.target.value;
                      setTimeZone(nextTimeZone);
                      setSelectedDate(
                        upcomingScheduleDays(new Date(), nextTimeZone, "en-US", 1)[0].iso
                      );
                      setSelectedSlot(null);
                    }}
                    aria-label={isBn ? "সময় অঞ্চল নির্বাচন করুন" : "Select timezone"}
                    className="bg-transparent border-0 text-[11px] font-mono text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value={timeZone}>{timeZone}</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>
              </div>

              {/* Horizontal Scrollable Date Strip */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {upcomingDays.map((day) => {
                  const isSelected = selectedDate === day.iso;
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      onClick={() => {
                        setSelectedDate(day.iso);
                        setSelectedSlot(null);
                      }}
                      className={`flex flex-col items-center justify-center min-w-[72px] py-3 rounded-2xl border transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : "border-border/70 bg-card hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase">{day.dayName}</span>
                      <span className="text-lg font-extrabold">{day.dayNumber}</span>
                      <span className="text-[10px] opacity-80">{day.monthName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Slots Grid */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isBn ? "৩. সময় স্লট নির্বাচন করুন" : "3. Available Time Slots"}
              </label>

              {loadingSlots ? (
                <div className="flex items-center justify-center py-12 rounded-2xl border bg-card/40">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-xs text-muted-foreground font-medium">
                    {isBn ? "স্লট অনুসন্ধান করা হচ্ছে..." : "Loading available slots..."}
                  </span>
                </div>
              ) : availabilityError ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-3 p-8 text-center rounded-2xl border border-destructive/30 bg-destructive/5 text-xs text-destructive"
                >
                  <span>
                    {isBn
                      ? "সময়সূচির সেবা এখন উপলভ্য নয়। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।"
                      : "Availability could not be loaded. Please try again shortly."}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAvailabilityRetry((value) => value + 1)}
                    className="rounded-xl border border-destructive/30 bg-background px-4 py-2 font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    {isBn ? "আবার চেষ্টা করুন" : "Try again"}
                  </button>
                </div>
              ) : slots.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border bg-muted/20 text-xs text-muted-foreground">
                  {isBn
                    ? "এই দিনে কোনো উন্মুক্ত স্লট পাওয়া যায়নি। অন্য একটি দিন বেছে নিন।"
                    : "No open slots found for this day. Please pick another date."}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {slots.map((slot, index) => {
                    const isSelected = selectedSlot?.start === slot.start;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary ring-2 ring-primary"
                            : "border-border/70 bg-card hover:border-primary/40 text-foreground"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5 opacity-70" />
                        <span>{formatSlotTime(slot.start)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Contact Details & Submit */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>{isBn ? "বুকিং বিবরণী" : "Consultation Details"}</span>
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {isBn ? "যোগাযোগের তথ্য" : "Attendee Information"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isBn
                    ? "মিটিং আমন্ত্রণ ও ক্যালেন্ডার লিংক এই ইমেইলে পাঠানো হবে।"
                    : "The calendar invite and meeting details will be sent to this email."}
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleBooking} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="scheduleName" className="block text-xs font-bold text-foreground">
                    {isBn ? "আপনার পূর্ণ নাম *" : "Your Full Name *"}
                  </label>
                  <input
                    id="scheduleName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isBn ? "যেমন: আব্দুর রহিম" : "e.g. Alex Morgan"}
                    className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="scheduleEmail" className="block text-xs font-bold text-foreground">
                    {isBn ? "কাজের ইমেইল ঠিকানা *" : "Work Email Address *"}
                  </label>
                  <div className="relative">
                    <input
                      id="scheduleEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={isBn ? "you@company.com" : "you@company.com"}
                      className="w-full rounded-xl border bg-background pl-9 pr-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    />
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="scheduleCompany" className="block text-xs font-bold text-foreground">
                    {isBn ? "কোম্পানি / প্রতিষ্ঠান (ঐচ্ছিক)" : "Company / Organization (Optional)"}
                  </label>
                  <input
                    id="scheduleCompany"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={isBn ? "যেমন: পেস্ট্রিম লিমিটেড" : "e.g. PayStream Financial"}
                    className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="scheduleNotes" className="block text-xs font-bold text-foreground">
                    {isBn ? "কী বিষয়ে আলোচনা করতে চান?" : "Discussion Goals / Scope"}
                  </label>
                  <textarea
                    id="scheduleNotes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      isBn
                        ? "আপনার প্রজেক্ট আইডিয়া, বর্তমান টেক স্ট্যাক বা ডেলিভারি লক্ষ্য সংক্ষেপে লিখুন..."
                        : "Briefly describe your project scope, target timeline, or architectural requirements..."
                    }
                    className="w-full rounded-xl border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-y"
                  />
                </div>

                {/* Selected Slot Summary Badge */}
                {selectedSlot ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      <div>
                        <span className="font-bold text-foreground block">
                          {selectedDate} • {formatSlotTime(selectedSlot.start)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {currentMeeting?.durationMinutes} {isBn ? "মিনিট" : "min"} ({timeZone})
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                      {isBn ? "নির্বাচিত" : "Selected"}
                    </Badge>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 p-3 text-center text-xs text-muted-foreground">
                    {isBn ? "বুকিং সম্পন্ন করতে বাম থেকে একটি সময় স্লট নির্বাচন করুন" : "Select an available time slot on the left"}
                  </div>
                )}

                {/* Turnstile verification */}
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                  strategy="afterInteractive"
                />
                {siteKey ? (
                  <div className="contact-turnstile py-1">
                    <div
                      className="cf-turnstile"
                      data-sitekey={siteKey}
                      data-action="schedule_booking"
                      data-language={locale}
                      data-size="compact"
                    />
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !selectedSlot ||
                    !name.trim() ||
                    !email.trim() ||
                    !siteKey
                  }
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{isBn ? "নিশ্চিত করা হচ্ছে..." : "Confirming Schedule..."}</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>{isBn ? "মিটিং নিশ্চিত করুন" : "Confirm Consultation"}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
