import { describe, expect, it } from "vitest";
import { scheduleDayRange } from "@/lib/schedule-time";

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
