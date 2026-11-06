import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

import {
  fetchClientProjects,
  fetchClientProjectById,
  fetchUpcomingClientAppointment,
} from "@/lib/portal/portal-server";

describe("Portal Server Data Fetching (FX-10)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_ENABLE_PORTAL_DEMO;
    delete process.env.ENABLE_PORTAL_DEMO;
  });

  it("returns empty array for signed-out user in production", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const projects = await fetchClientProjects();
    expect(projects).toEqual([]);

    const single = await fetchClientProjectById("proj-1");
    expect(single).toBeNull();
  });

  it("returns empty array if user has no client row", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.from.mockImplementation((table: string) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const projects = await fetchClientProjects();
    expect(projects).toEqual([]);

    const single = await fetchClientProjectById("proj-1");
    expect(single).toBeNull();
  });

  it("filters projects explicitly by client_id", async () => {
    const eqSpy = vi.fn();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.from.mockImplementation((table: string) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "client-abc" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "projects") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              eqSpy(col, val);
              return {
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            },
          }),
        };
      }
      return {};
    });

    const projects = await fetchClientProjects();
    expect(projects).toEqual([]);
    expect(eqSpy).toHaveBeenCalledWith("client_id", "client-abc");
  });

  it("returns demo catalog only when explicit demo flag is enabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_PORTAL_DEMO = "true";
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const projects = await fetchClientProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0].id).toBe("proj-fintech-01");

    const single = await fetchClientProjectById("proj-fintech-01");
    expect(single).not.toBeNull();
    expect(single?.id).toBe("proj-fintech-01");
  });

  it("loads the signed-in client's next active appointment", async () => {
    const meetingEq = vi.fn();
    const statusIn = vi.fn();
    const endsAfter = vi.fn();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.from.mockImplementation((table: string) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "client-abc" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "meetings") {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              meetingEq(column, value);
              return {
                in: (statusColumn: string, statuses: string[]) => {
                  statusIn(statusColumn, statuses);
                  return {
                    gt: (endColumn: string, endValue: string) => {
                      endsAfter(endColumn, endValue);
                      return {
                        order: () => ({
                          limit: () => ({
                            maybeSingle: vi.fn().mockResolvedValue({
                              data: {
                                id: "meeting-1",
                                starts_at: "2027-01-10T10:00:00.000Z",
                                ends_at: "2027-01-10T10:30:00.000Z",
                                created_at: "2027-01-01T08:00:00.000Z",
                                attendee_timezone: "Asia/Dhaka",
                                status: "confirmed",
                                meeting_types: {
                                  name_en: "Discovery Call",
                                  name_bn: "ডিসকভারি কল",
                                },
                              },
                              error: null,
                            }),
                          }),
                        }),
                      };
                    },
                  };
                },
              };
            },
          }),
        };
      }
      return {};
    });

    await expect(fetchUpcomingClientAppointment()).resolves.toEqual({
      id: "meeting-1",
      meetingTypeNameEn: "Discovery Call",
      meetingTypeNameBn: "ডিসকভারি কল",
      startsAt: "2027-01-10T10:00:00.000Z",
      endsAt: "2027-01-10T10:30:00.000Z",
      bookedAt: "2027-01-01T08:00:00.000Z",
      timeZone: "Asia/Dhaka",
      status: "confirmed",
    });
    expect(meetingEq).toHaveBeenCalledWith("client_id", "client-abc");
    expect(statusIn).toHaveBeenCalledWith("status", ["confirmed", "rescheduled"]);
    expect(endsAfter).toHaveBeenCalledWith("ends_at", expect.any(String));
  });
});
