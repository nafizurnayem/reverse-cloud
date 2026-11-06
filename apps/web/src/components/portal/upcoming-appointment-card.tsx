"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Timer } from "lucide-react";
import type { PortalAppointment } from "@/lib/portal/types";
import { getAppointmentTiming } from "@/lib/portal/appointment-time";
import { toBanglaDigits } from "@/lib/money";

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

export function UpcomingAppointmentCard({
  appointment,
  locale,
}: {
  appointment: PortalAppointment;
  locale: "en" | "bn";
}) {
  const isBn = locale === "bn";
  const [now, setNow] = useState<number | null>(null);
  const timeZone = useMemo(() => validTimeZone(appointment.timeZone), [appointment.timeZone]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const timing = getAppointmentTiming(appointment.startsAt, appointment.endsAt, now ?? 0);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(isBn ? "bn-BD" : "en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone,
    }),
    [isBn, timeZone],
  );
  const bookedFormatter = useMemo(
    () => new Intl.DateTimeFormat(isBn ? "bn-BD" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }),
    [isBn, timeZone],
  );
  const digits = (value: number) => isBn ? toBanglaDigits(value) : String(value);
  const meetingName = isBn
    ? appointment.meetingTypeNameBn || appointment.meetingTypeNameEn
    : appointment.meetingTypeNameEn;

  return (
    <section aria-labelledby="upcoming-appointment-title" className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {appointment.status === "rescheduled"
                ? (isBn ? "পুনঃনির্ধারিত" : "Rescheduled")
                : (isBn ? "নিশ্চিত অ্যাপয়েন্টমেন্ট" : "Confirmed appointment")}
            </span>
            <span className="text-xs text-muted-foreground">{timeZone}</span>
          </div>
          <div>
            <h2 id="upcoming-appointment-title" className="text-xl font-bold tracking-tight text-foreground">
              {meetingName}
            </h2>
            <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{dateFormatter.format(new Date(appointment.startsAt))}</span>
            </p>
            <p className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {isBn ? "বুক করা হয়েছে" : "Booked on"}: {bookedFormatter.format(new Date(appointment.bookedAt))}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/35 p-4 lg:min-w-[23rem]">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Timer className="h-4 w-4 text-primary" aria-hidden="true" />
            {timing.phase === "upcoming"
              ? (isBn ? "মিটিং শুরু হতে বাকি" : "Meeting starts in")
              : timing.phase === "in_progress"
                ? (isBn ? "মিটিং চলছে" : "Meeting in progress")
                : (isBn ? "মিটিং শেষ হয়েছে" : "Meeting has ended")}
          </div>
          {now === null ? (
            <div className="h-12 animate-pulse rounded-lg bg-muted" aria-label={isBn ? "কাউন্টডাউন লোড হচ্ছে" : "Loading countdown"} />
          ) : timing.phase === "upcoming" ? (
            <div className="grid grid-cols-4 gap-2" role="timer" aria-label={isBn ? "মিটিং শুরুর কাউন্টডাউন" : "Countdown until meeting starts"}>
              {[
                [timing.days, isBn ? "দিন" : "Days"],
                [timing.hours, isBn ? "ঘণ্টা" : "Hours"],
                [timing.minutes, isBn ? "মিনিট" : "Minutes"],
                [timing.seconds, isBn ? "সেকেন্ড" : "Seconds"],
              ].map(([value, label]) => (
                <div key={String(label)} className="rounded-lg bg-background px-2 py-2 text-center shadow-sm">
                  <div className="font-mono text-lg font-bold text-primary sm:text-xl">{digits(Number(value))}</div>
                  <div className="text-[10px] font-medium text-muted-foreground sm:text-xs">{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-background px-4 py-3 text-sm text-muted-foreground">
              {timing.phase === "in_progress"
                ? (isBn ? "আপনার নির্ধারিত মিটিং এখন চলছে।" : "Your scheduled meeting is currently in progress.")
                : (isBn ? "এই অ্যাপয়েন্টমেন্টের সময় শেষ হয়েছে।" : "This appointment time has finished.")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
