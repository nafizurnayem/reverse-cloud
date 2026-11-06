export type AppointmentPhase = "upcoming" | "in_progress" | "ended";

export interface AppointmentTiming {
  phase: AppointmentPhase;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function getAppointmentTiming(
  startsAt: string,
  endsAt: string,
  nowMs = Date.now(),
): AppointmentTiming {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || nowMs >= endMs) {
    return { phase: "ended", days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  if (nowMs >= startMs) {
    return { phase: "in_progress", days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSeconds = Math.max(0, Math.floor((startMs - nowMs) / 1_000));
  return {
    phase: "upcoming",
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}
