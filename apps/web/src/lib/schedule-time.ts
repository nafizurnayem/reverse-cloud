function timeZoneOffset(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  ) - Math.floor(timestamp / 1_000) * 1_000;
}

function localTimeToUtc(timestamp: number, timeZone: string) {
  let result = timestamp;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const adjusted = timestamp - timeZoneOffset(result, timeZone);
    if (adjusted === result) break;
    result = adjusted;
  }
  return new Date(result).toISOString();
}

export function scheduleDayRange(date: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("invalid_schedule_date");
  const midnight = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return {
    start: localTimeToUtc(midnight, timeZone),
    end: localTimeToUtc(midnight + 24 * 60 * 60 * 1_000, timeZone),
  };
}

export function upcomingScheduleDays(
  now: Date,
  timeZone: string,
  locale: string,
  count = 14
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localToday = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    12
  );

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(localToday + (index + 1) * 24 * 60 * 60 * 1_000);
    return {
      iso: date.toISOString().slice(0, 10),
      dayName: date.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }),
      dayNumber: date.toLocaleDateString(locale, { day: "numeric", timeZone: "UTC" }),
      monthName: date.toLocaleDateString(locale, { month: "short", timeZone: "UTC" }),
    };
  });
}
