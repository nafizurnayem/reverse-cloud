import { describe, expect, it } from "vitest";
import { getAppointmentTiming } from "@/lib/portal/appointment-time";

describe("portal appointment countdown", () => {
  it("returns the remaining days, hours, minutes, and seconds", () => {
    expect(getAppointmentTiming(
      "2027-01-03T04:05:06.000Z",
      "2027-01-03T05:05:06.000Z",
      Date.parse("2027-01-01T00:00:00.000Z"),
    )).toEqual({ phase: "upcoming", days: 2, hours: 4, minutes: 5, seconds: 6 });
  });

  it("reports a meeting in progress after it starts", () => {
    expect(getAppointmentTiming(
      "2027-01-01T10:00:00.000Z",
      "2027-01-01T10:30:00.000Z",
      Date.parse("2027-01-01T10:15:00.000Z"),
    ).phase).toBe("in_progress");
  });

  it("reports a meeting as ended at its end time", () => {
    expect(getAppointmentTiming(
      "2027-01-01T10:00:00.000Z",
      "2027-01-01T10:30:00.000Z",
      Date.parse("2027-01-01T10:30:00.000Z"),
    ).phase).toBe("ended");
  });
});
