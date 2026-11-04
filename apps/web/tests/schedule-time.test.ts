import { describe, expect, it } from "vitest";
import { scheduleDayRange, upcomingScheduleDays } from "@/lib/schedule-time";

describe("scheduleDayRange", () => {
  it.each([
    ["Asia/Dhaka", "2026-11-05", "2026-11-04T18:00:00.000Z", "2026-11-05T18:00:00.000Z"],
    ["Europe/London", "2026-07-10", "2026-07-09T23:00:00.000Z", "2026-07-10T23:00:00.000Z"],
    ["America/New_York", "2026-03-08", "2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z"],
    ["America/New_York", "2026-11-01", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"],
  ])("uses the local day boundaries in %s", (timeZone, date, start, end) => {
    expect(scheduleDayRange(date, timeZone)).toEqual({ start, end });
  });
});

describe("upcomingScheduleDays", () => {
  it("keeps Dhaka date labels and submitted ISO dates aligned after midnight", () => {
    const days = upcomingScheduleDays(
      new Date("2026-11-04T19:42:00.000Z"),
      "Asia/Dhaka",
      "en-US",
      5
    );

    expect(days).toEqual([
      { iso: "2026-11-06", dayName: "Fri", dayNumber: "6", monthName: "Nov" },
      { iso: "2026-11-07", dayName: "Sat", dayNumber: "7", monthName: "Nov" },
      { iso: "2026-11-08", dayName: "Sun", dayNumber: "8", monthName: "Nov" },
      { iso: "2026-11-09", dayName: "Mon", dayNumber: "9", monthName: "Nov" },
      { iso: "2026-11-10", dayName: "Tue", dayNumber: "10", monthName: "Nov" },
    ]);
  });
});
